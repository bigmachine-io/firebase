const functions = require('firebase-functions');
const cors = require("cors")({origin: true});
const co = require("co");
const Checkout = require("./lib/checkout");
const Fulfillment = require("./lib/fulfillment");
let db = require("./lib/db");
const stripe = require("stripe")(functions.config().stripe.token);


exports.stripe_charge = functions.https.onRequest((req, res) => {
  const post = req.body;
  console.log("Executing charge", post.order);
  if(post.order && post.payment){
    co(function*(){
      try{
        //create the checkout
        console.log("Creating the checkout");
        const checkout = Checkout.forNewOrder({order: post.order, payment: post.payment, db: db});
        
        //reset the items on the order because we don't trust the client
        console.log("Setting the products");
        yield checkout.setProducts();
        
        //tally up the sale with proper amounts and data structure
        console.log("Tallying order...")
        const sale = checkout.tallyOrder();

        //DECISION: nothing goes into the DB unless it's charged
        //OPTION: put the sale in without the charge and respond
        //        to a new sale event...

        //execute the stripe charge
        console.log("Calling stripe...")
        const charge = yield stripe.charges.create({
          amount: sale.order.amountDue,
          currency: "usd",
          source: sale.payment.id, //the stripe token
          description: `Charge for order ${sale.order.id}`
        });

        //save it!
        console.log(`Charge succeeded: ${charge.id}`)
        yield checkout.recordStripeCapture(sale, charge);

        return {success: true, sale: sale};
      }catch(err){
        return {sucess: false, error: err};
      }
    }).then(result => {
      if(res.test) res.send(result); //HACK
      else cors(req,res, () => {res.send(result)})
    }).catch(err => {
      console.error("CHARGE ERROR", err);
      if(res.test) res.send(err); //HACK
      else cors(req,res, () => {res.send(err)})
    });
  }else{
    const message = "Missing order or payment on "
    console.log(message, req.body);
    if(res.test) res.send(message);
    else cors(req, res, () => {res.send(message)});
  }
});

exports.fulfillment = functions.database.ref("sales/{id}/transaction").onWrite(ev => {
  //this fires whenever ****** any data is changed ******** in the sales db
  //inserts, updates, deletes
  const saleId = ev.params.id;
  if(ev.db) db = ev.db;//sorry...
  console.log(`Fulfilling checkout ${saleId}`);
  
  return co(function*(){
    try{
      //pull the sale
      const sale = yield db.getSale(saleId);
      if(sale){
        console.log(sale)
        const fulfillment = Fulfillment.forNewSale({sale: sale, db: db});

        //provision downloads/shipments
        //must come first! The invoice needs to use the 
        //fulfillment to generate deliverables
        console.log("Provisioning...")
        yield fulfillment.provisionItems();

        //create an invoice
        console.log("Creating invoice");
        yield fulfillment.createInvoice();
        
        return {success: true, sale: sale};
      }else{
        return false;
      }

    }catch(err){
      console.error(err);
      return {success: false, error: err};
    }
  });
});