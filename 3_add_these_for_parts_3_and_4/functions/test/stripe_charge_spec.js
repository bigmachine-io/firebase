const assert = require('assert');
const helpers = require('./helpers');
const functions = require('firebase-functions'); 
const payment = require("./fakes/stripe_token");

helpers.nockStripe();
//helpers.stubConfig()

const funcs = require("../index");
const fakeOrder = require("./fakes/order").init();

describe.skip('Stripe Charge Function', function(){
  describe('when a valid order comes in', function(){
    let result = null;
    before(function(done){
      const post = {
        order : fakeOrder,
        payment: payment
      }
      const req = {body: post};
      const res = {
        test: true,
        send: arg => {
          result = arg;
          done();
        }
      }
      funcs.stripe_charge(req,res);
    })
    it('returns OK', function(){
      assert(result.success, result.error);
    });
    it('has an id for the sale', function(){
      assert(result.sale.order.id, result.error);
    });
    it('has a transaction', function(){
      assert(result.sale.transaction, result.error);
    });
  });
});