
const getDiscountPrice = (product) => {
  if (!product) {
    return null;
  }
  let productOffer = product.productOffer || 0;
  let categoryOffer = product.category?.categoryOffer || 0;

  let maxOffer = Math.max(productOffer, categoryOffer);
  let discountedPrice = product.salePrice - (product.salePrice * maxOffer) / 100;

  return {
    ...product.toObject(),
    finalPrice: Math.round(discountedPrice),
    appliedOffer: maxOffer,
    regularPrice: product.regularPrice,
  };
}

const getDiscountPriceCart = (product) => {
  // if (!product) return null;

  //   if (!product.category || !product.category.isListed) {
  //       product.isAvailable = false;
  //       return product;
  //   }
  if (!product) {
    console.error("getDiscountPriceCart: Received null/undefined product");
    return null;
  }
  let productOffer = product.productOffer || 0;
  let categoryOffer = product.category?.categoryOffer || 0;

  let maxOffer = Math.max(productOffer, categoryOffer);
  let discountedPrice = product.salePrice - (product.salePrice * maxOffer) / 100;



  product.finalPrice = Math.round(discountedPrice);
  product.appliedOffer = maxOffer;
  product.regularPrice = product.regularPrice;

  return product;
}

module.exports = { getDiscountPrice, getDiscountPriceCart };