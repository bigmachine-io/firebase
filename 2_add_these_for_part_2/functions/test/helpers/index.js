const nock = require("nock");
const functions = require('firebase-functions'); 
//fake this - do it before requiring funcs below
let configStubbed = false; //setting the config twice will cause an error

if(!configStubbed){
  functions.config = () => ({
    firebase: {
      databaseURL: 'https://not-a-project.firebaseio.com',
      storageBucket: 'not-a-project.appspot.com',
    },
    stripe: {
      token: "bloop"
    },
    drip: {
      token: "shnoop"
    },
    pg: {
      url: "doop"
    }
  });
  configStubbed = true;
}


exports.nockStripe = () => {
  nock("https://api.stripe.com/v1")
    .post("/charges")
    .reply(200, {id: "OK"});
}
exports.nockStripeRefundEvent = () => {
  nock("https://api.stripe.com/v1")
    .get("/events/xxx")
    .reply(200, {
      id: "OK",
      type: "charge.refunded",
      data: {
        object: {
          id: "TEST"
        }
      }
    });

  nock("https://api.stripe.com/v1")
    .get("/events/zzz")
    .reply(400, {id: 0});

}