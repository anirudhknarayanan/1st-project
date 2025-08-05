

const updateProductSalePrice = async (product, categoryOffer = null) => {
  const Product = require("../models/productSchema");
  const Category = require("../models/categorySchema");

  try {
    
    if (categoryOffer === null && product.category) {
      const category = await Category.findById(product.category);
      categoryOffer = category?.categoryOffer || 0;
    }

    const productOffer = product.productOffer || 0;
    const maxOffer = Math.max(productOffer, categoryOffer || 0);


    const newSalePrice = product.regularPrice - (product.regularPrice * maxOffer / 100);

    console.log(`Product: ${product.productName}, ProductOffer: ${productOffer}%, CategoryOffer: ${categoryOffer}%, MaxOffer: ${maxOffer}%, NewSalePrice: ₹${Math.round(newSalePrice)}`);

   
    await Product.findByIdAndUpdate(product._id, {
      salePrice: Math.round(newSalePrice)
    });

    return Math.round(newSalePrice);
  } catch (error) {
    console.error("Error updating product sale price:", error);
    throw error;
  }
};


const updateMultipleProductsSalePrice = async (products, categoryOffer) => {
  const Product = require("../models/productSchema");

  try {
    const bulkOps = products.map(product => {
      const productOffer = product.productOffer || 0;
      const maxOffer = Math.max(productOffer, categoryOffer || 0);
      const newSalePrice = product.regularPrice - (product.regularPrice * maxOffer / 100);

      console.log(`Product: ${product.productName}, ProductOffer: ${productOffer}%, CategoryOffer: ${categoryOffer}%, MaxOffer: ${maxOffer}%, NewSalePrice: ₹${Math.round(newSalePrice)}`);

      return {
        updateOne: {
          filter: { _id: product._id },
          update: { salePrice: Math.round(newSalePrice) }
        }
      };
    });

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
      console.log(`Updated salePrice for ${bulkOps.length} products`);
    }
  } catch (error) {
    console.error("Error updating multiple products sale price:", error);
    throw error;
  }
};

const getDiscountPrice = (product) => {
  if (!product) {
    return null;
  }
  let productOffer = product.productOffer || 0;
  let categoryOffer = product.category?.categoryOffer || 0;

  let maxOffer = Math.max(productOffer, categoryOffer);
 
  let finalPrice = product.salePrice;

 
  let appliedOfferType = null;
  if (maxOffer > 0) {
    if (productOffer > categoryOffer) {
      appliedOfferType = 'product';
    } else if (categoryOffer > 0) {
      appliedOfferType = 'category';
    }
  }

  return {
    ...(product.toObject ? product.toObject() : product),
    finalPrice: Math.round(finalPrice),
    appliedOffer: maxOffer,
    appliedOfferType: appliedOfferType,
    regularPrice: product.regularPrice,
  };
}

const getDiscountPriceCart = (product) => {
  if (!product) {
    console.error("getDiscountPriceCart: Received null/undefined product");
    return null;
  }

  let productOffer = product.productOffer || 0;
  let categoryOffer = product.category?.categoryOffer || 0;

  let maxOffer = Math.max(productOffer, categoryOffer);
 
  let finalPrice = product.salePrice;

 
  let appliedOfferType = null;
  if (maxOffer > 0) {
    if (productOffer > categoryOffer) {
      appliedOfferType = 'product';
    } else if (categoryOffer > 0) {
      appliedOfferType = 'category';
    }
  }

  product.finalPrice = Math.round(finalPrice);
  product.appliedOffer = maxOffer;
  product.appliedOfferType = appliedOfferType;
  product.regularPrice = product.regularPrice;

  return product;
}

module.exports = {
  getDiscountPrice,
  getDiscountPriceCart,
  updateProductSalePrice,
  updateMultipleProductsSalePrice
};