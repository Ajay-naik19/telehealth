const pharmacyService = require('./pharmacy.service');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');

// ── API Endpoints ──

exports.apiGetCategories = catchAsync(async (req, res) => {
    const categories = await pharmacyService.getCategories();
    return sendResponse(res, 200, 'Categories fetched successfully', { categories });
});

exports.apiListProducts = catchAsync(async (req, res) => {
    const data = await pharmacyService.listProducts(req.query);
    return sendResponse(res, 200, 'Products fetched successfully', data);
});

exports.apiGetProduct = catchAsync(async (req, res) => {
    const data = await pharmacyService.getProduct(req.params.slug, req.user?.id);
    return sendResponse(res, 200, 'Product fetched successfully', data);
});

exports.apiAddToCart = catchAsync(async (req, res) => {
    const { productId, quantity } = req.validated.body;
    const result = await pharmacyService.addToCart(req.user.id, productId, quantity);
    return sendResponse(res, 200, 'Added to cart', result);
});

exports.apiUpdateCart = catchAsync(async (req, res) => {
    const { productId, quantity } = req.validated.body;
    const result = await pharmacyService.updateCartItem(req.user.id, productId, quantity);
    return sendResponse(res, 200, 'Cart updated', result);
});

exports.apiRemoveFromCart = catchAsync(async (req, res) => {
    const productId = parseInt(req.params.productId);
    const result = await pharmacyService.removeFromCart(req.user.id, productId);
    return sendResponse(res, 200, 'Removed from cart', result);
});

exports.apiGetCart = catchAsync(async (req, res) => {
    const cart = await pharmacyService.getCart(req.user.id);
    return sendResponse(res, 200, 'Cart fetched successfully', cart);
});

exports.apiPlaceOrder = catchAsync(async (req, res) => {
    const shippingInfo = req.validated.body;
    const order = await pharmacyService.placeOrder(req.user.id, shippingInfo);
    return sendResponse(res, 200, 'Order placed successfully!', { order });
});

exports.apiGetOrders = catchAsync(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const orders = await pharmacyService.getOrders(req.user.id, page);
    return sendResponse(res, 200, 'Orders fetched successfully', { orders });
});

exports.apiGetOrderDetail = catchAsync(async (req, res) => {
    const order = await pharmacyService.getOrderDetail(parseInt(req.params.id), req.user.id);
    return sendResponse(res, 200, 'Order detail fetched successfully', { order });
});

exports.apiSubmitReview = catchAsync(async (req, res) => {
    const { productId, rating, title, comment } = req.validated.body;
    const review = await pharmacyService.submitReview(req.user.id, productId, rating, title, comment);
    return sendResponse(res, 200, 'Review submitted', { review });
});

exports.apiGetReviews = catchAsync(async (req, res) => {
    const productId = parseInt(req.params.productId);
    const page = parseInt(req.query.page) || 1;
    const PharmacyModel = require('./pharmacy.model');
    const reviews = await PharmacyModel.getProductReviews(productId, page, 10);
    return sendResponse(res, 200, 'Reviews fetched successfully', { reviews });
});

exports.apiToggleWishlist = catchAsync(async (req, res) => {
    const { productId } = req.validated.body;
    const result = await pharmacyService.toggleWishlist(req.user.id, productId);
    return sendResponse(res, 200, 'Wishlist updated successfully', result);
});

exports.apiGetWishlist = catchAsync(async (req, res) => {
    const wishlist = await pharmacyService.getWishlist(req.user.id);
    return sendResponse(res, 200, 'Wishlist fetched successfully', { wishlist });
});
