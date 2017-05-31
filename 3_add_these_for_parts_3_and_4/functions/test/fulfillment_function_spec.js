const assert = require('assert');
const helpers = require("./helpers");

const functions = require('firebase-functions');
const db = require("./fakes/db").init();
const Checkout = require("../lib/checkout");
const order = require("./fakes/order").init();
const payment = require("./fakes/stripe_token");

//helpers.stubConfig();
const funcs = require('../index');

describe.skip('The fulfill_checkout function', function(){
  let checkout = null;
  before(function(){
    checkout = Checkout.forNewOrder({db: db, order: order, payment: payment});
    return checkout.setProducts().then(x => {
      sale = checkout.tallyOrder();
      return checkout.recordStripeCapture(sale, {id: "OK"});
    });
  });
  describe('with a valid transaction', function(){
    let result = null;
    before(function(){
      const ev = {
        db: db, //HACK
        params : {id: checkout.id},
        data: new functions.database.DeltaSnapshot(null,null,null,null)
      }
      return funcs.fulfill_checkout(ev).then(res => result = res);
    });
    it('is successful', function(){
      console.log(result)
      assert(result.success, result.error);
    });
  })
});