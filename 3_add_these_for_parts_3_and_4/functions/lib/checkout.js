const assert = require('assert');
const co = require("co");
const geo = require("geoip-lite");

//a checkout is a process
class Checkout{

  constructor(args){

    //validate the bits passed
    assert(args.db, "Need a database instance");
    assert(args.order, "Need an order");
    assert(args.order.email, "Need an email");
    assert(args.order.id, "Need an order id");
    assert(args.order.ip, "No IP address passed in");
    assert(args.order.items, "Need some items on the order");
    assert(args.order.items.map(x => x.sku).length > 0, "Each item must have a sku");
    assert(args.payment, "Need a payment");
    
    this.db = args.db;
    this.order = args.order;
    this.payment = args.payment;
  }

  setProducts(){
    //pull the skus from the items
    const order = this.order;
    const skus = order.items.map(x => x.sku);
    //get the products from the DB
    return this.db.getProducts(skus).then(products => {
      //calculating these
      let newItems = [], amountDue = 0;
      for(let item of order.items){
        const product = products.find(x => x.sku === item.sku);
        if(product){
          amountDue+= ((item.quantity || 1) * product.price); //adjust for discount as needed
          newItems.push({quantity: item.quantity, product: product});
        }
      }
      order.items = newItems;
      order.amountDue = amountDue;
      return Promise.resolve(true);
      
    }).catch(err => Promise.reject(err));
  }
  tallyOrder(){
    //tada! Our new sale event
    return {
      id: this.order.id,
      ip: this.order.ip,
      order: {
        id: this.order.id,
        items: this.order.items,
        amountDue: this.order.amountDue,
      },
      amountPaid: 0,
      customer: {
        name: "",
        email: this.order.email,
      },
      fulfillment: false,
      transaction: false,
      payment: this.payment,
      notification: false,
      geo: geo.lookup(this.order.ip),
      progress: {
        tallied: true,
        captured: false,
        invoiced: false,
        fulfilled: false,
        notified: false,
        completed: false
      }
    }
  }

  recordStripeCapture(sale, charge){
    //set the transaction
    sale.transaction = charge;
    sale.amountPaid = sale.order.amountDue;
    sale.processor = "stripe";
    //since we know this is stripe, we can set the name on the order
    sale.customer.name = sale.payment.card.name;
    //tick the progress
    sale.progress.captured = true;
    console.log(sale)
    //save it!
    return this.db.createSale(sale);
  }
};

exports.forNewOrder = function(args){
  return new Checkout(args);
}