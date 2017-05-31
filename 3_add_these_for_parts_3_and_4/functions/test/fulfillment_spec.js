const assert = require('assert');
const Checkout = require("../lib/checkout");
const Fufillment = require("../lib/fulfillment");
const db = require("./fakes/db").init();
const order = require("./fakes/order").init();
const payment = require("./fakes/stripe_token");

describe('Fulfillment', function(){
  let fulfillment=null, sale = null, checkout = null;
  before(function(){
    checkout = Checkout.forNewOrder({db: db, order: order, payment: payment});
    return checkout.setProducts().then(x => {
      sale = checkout.tallyOrder();
      checkout.recordStripeCapture(sale, {id: "OK"});
    });
  });
  describe('when a sale is captured', function(){
    before(function() {
      fulfillment = Fufillment.forNewSale({db: db, sale: sale});
      return fulfillment.provisionItems();
    });

    it('successful', function(){
      assert(sale.fulfillment)
    });
    it('creates two downloads for fulfillment', function(){
      const keys = Object.keys(sale.fulfillment);
      assert.equal(2, keys.length)
    });
  });
  describe('creating an invoice', function(){

    before(function() {
      return fulfillment.createInvoice();
    });

    it('successful', function(){
      assert(sale.invoice);
    });
    it('that invoice has deliverables', function(){
      console.log(sale.invoice.deliverables);
      const keys = Object.keys(sale.invoice.deliverables);
      assert.equal(2, keys.length);
    });
  });
});