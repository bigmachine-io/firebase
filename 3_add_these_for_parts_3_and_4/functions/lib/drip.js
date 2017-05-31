const request = require("request");
const functions = require('firebase-functions');

const options = {
  uri: 'YOUR DRIP URI',
  auth: {user: functions.config().drip.token},
  method: 'POST'
};

exports.reportNewOrder = (sale) => {
  options.json = {
    events: [{
      email: sale.customer.email,
      action: "New Order",
      properties: {
        name: sale.customer.name,
        order_id: sale.id,
        charge: sale.transaction.id
      },
      occurred_at: new Date()
    }]
  };
  return new Promise((resolve, reject) => {
    return request(options, function (error, response, body) {
      if(error) {
        return resolve({success: false, error: error});
      }else{
        sale.notification = {
          send_date: new Date(),
          email: sale.customer.email,
          event: "New Order"
        }
        sale.progress.notified = true;
        return resolve(sale)
      }
    });
  });
}



