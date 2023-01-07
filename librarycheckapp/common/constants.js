const URL_BASE = 'https://www.amazon.co.jp/hz/wishlist/ls/';
const IMAGE_URL = (asin) =>`https://images-fe.ssl-images-amazon.com/images/P/${asin}.09.TZZZZZZZ`;
const AMAZON_PRODUCT_URL = (asin) =>`https://www.amazon.co.jp/dp/${asin}/`;
const CALIL_API_URL = 'https://api.calil.jp/check';
const GOOGLE_API_URL = 'https://www.googleapis.com/books/v1/volumes';

const SELECTORS = {
    wishlistItemDiv: '.g-item-sortable',
    wishlistItemName: (id) => `#itemName_${id}`,
    wishlistItemByLine: (id) => `#item-byline-${id}`,
};

const ASIN = {
    start : 5,
    end : 15
};

const PRODUCT_ISBN_FLG = {
    ok : 'OK',
    ng : 'NG'
};

module.exports = {
    URL_BASE,
    IMAGE_URL,
    AMAZON_PRODUCT_URL,
    CALIL_API_URL,
    GOOGLE_API_URL,
    SELECTORS,
    ASIN,
    PRODUCT_ISBN_FLG
};