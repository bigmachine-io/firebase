const assert = require('assert');
const Checkout = require("../lib/checkout");
const db = require("./fakes/db").init();
const order = require("./fakes/order").init();
const payment = {id: "OK"};

describe('Checkout process', function(){
  let sale=null, checkout = null;
  before(function(){
    checkout = Checkout.forNewOrder({db: db, order: order, payment: payment});
  });
  describe('when a valid order is received', function(){
    before(function() {
      return checkout.setProducts().then(x => {
        sale = checkout.tallyOrder();
      });
    });
    it('has tallied progress', function(){
      assert(sale.progress.tallied)
    });
    it('has an amountDue of 7410', function(){
      assert.equal(7410, sale.order.amountDue);
    });
    it('has an amountPaid of 0', function(){
      assert.equal(0, sale.amountPaid);
    });
    it('is geo tagged', function(){
      assert(sale.geo);
      console.log(sale.geo);
    });
    it('has a customer with test email', function(){
      assert.equal("test@test.com", sale.customer.email);
    });
    it('has two products', function(){
      assert.equal(2, sale.order.items.map(x => x.product).length);
    });
  });

});