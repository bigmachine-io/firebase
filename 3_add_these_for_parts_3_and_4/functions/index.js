const functions = require('firebase-functions');
const cors = require("cors")({origin: true});
const co = require("co");
const Checkout = require("./lib/checkout");
const Fulfillment = require("./lib/fulfillment");
let db = require("./lib/db");
const stripe = require("stripe")(functions.config().stripe.token);
const drip = require("./lib/drip");
const downloader = require("./lib/downloader").init({db: db});

exports.download = functions.https.onRequest((req, res) => {
  const downloadId = req.query.id;
  const orderId = req.query.oid;

  if(downloadId && orderId){
    console.log(`Getting download for ${orderId}`);
    downloader.processDownload(orderId,downloadId).then(result => {
      console.log("URL generated: ", result);
      cors(req, res, () => res.send(result));
    }).catch(err => {
      console.error(err);
    });
  }else{
    res.sendStatus(403)
  }
});


exports.stripe_refund = functions.https.onRequest((req, res) => {
  const post = req.body;
  console.log("Refund incoming...");

  co(function*(){
    //ping stripe to verify the id
    try{
      const ev = yield stripe.events.retrieve(post.id);

      //if we have an event, see what it is. It should only be a refund
      if(ev.type === "charge.refunded"){

        //an updated transaction
        const tx = ev.data.object;

        //need the charge id
        const chargeId = ev.data.object.id;
        console.log(chargeId)

        //find the sale with that transaction id
        const query = yield db.getSaleByTransaction(chargeId);
        if(query && query.length > 0){
          const sale = query[0];
          if(!sale.progress.refunded){
            progress = sale.progress;
            progress.refunded = true;
            //reset the transaction
            yield db.updateSale(sale.id, {
              transaction: tx,
              amountRefunded: sale.amountPaid,
              progress: progress
            });
          }
        }

      }

      return {success: true, event: ev};
    }catch(err){
      return {success: false, error: err};
    }

  }).then(result => {
    if(result.success){
      console.log("Handled")
      res.sendStatus(200);
    }else{
      console.error(result.error);
      res.sendStatus(400);
    }
  });

});

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

exports.notification = functions.database.ref("sales/{id}/invoice").onWrite(ev => {
  const saleId = ev.params.id;
  console.log(`Notifying customer for ${saleId}`);
  return co(function*(){
    try{
      let sale = yield db.getSale(saleId);
      if(sale && !sale.notification){
        console.log("Pinging drip...");
        sale = yield drip.reportNewOrder(sale);
        console.log("Email sent!");

        //send it to compose
        console.log("Sending to Compose...")
        console.log(sale)
        yield db.exportSale(sale);

        //complete it
        sale.progress.completed = true;

        //save the sale
        yield db.updateSale(sale.id, {
          notification: sale.notification,
          progress: sale.progress
        });

        return true;
      }else{
        return false;
      }
    }catch(err){
      console.error(err);
    }
  });
});
