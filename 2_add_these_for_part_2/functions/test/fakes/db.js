const catalog = require('./catalog');

class FakeDB{
  constructor(){
    this.sale = null;
  }
  getProducts(skus){
    const products = catalog.filter(x => {
      return skus.indexOf(x.sku) > -1;
    });
    return Promise.resolve(products);
  }
  createSale(sale){
    this.sale = sale;
    return Promise.resolve(sale);
  }
  updateSale(id, updates){
    Object.assign(this.sale, updates);
    return Promise.resolve(this.sale);
  }
  getSale(id){
    return Promise.resolve(this.sale);
  }
  getSaleByTransaction(id){
    return Promise.resolve({id: id}); 
  }
};

exports.init = () => new FakeDB();
