const amazonWishScraper = require('./amazonWishListScraper');

async function main() {
  const itemList = await amazonWishScraper.getProductInfo('145VXU80F2LO1');
  amazonWishScraper.funca();
  console.log("a");
  console.log('itemList', JSON.stringify(itemList));
}

main();