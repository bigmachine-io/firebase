const FakeOrder = function(){
  return {
    id: "TEST",
    ip: "24.18.4.121",
    email: "test@test.com",
    items : [
      { sku: "honeymoon-mars",  quantity: 1},
      { sku: "mars-trek",  quantity: 1}
    ]
  }
};
exports.init = () => new FakeOrder();