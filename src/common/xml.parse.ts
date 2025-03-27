import { IProduct } from 'src/common/interface';
import * as xml2js from 'xml2js';

export const xmlToArray = (
  file: Express.Multer.File,
  priceDifference: string,
  chunkSize: number,
) => {
  const parser = new xml2js.Parser();
  const xmlContent = file.buffer.toString('utf-8');
  const result: any = parser.parseStringPromise(xmlContent);
  const items = result.rss.channel[0].item;

  const products: IProduct[] = items.map((item: any) => {
    const priceString = item['g:price'][0];
    const approximatePrice = parseFloat(priceString.replace(/[^\d.-]/g, ''));
    return {
      id: item['g:id'][0],
      title: item['g:title'][0],
      approximatePrice: approximatePrice,
      priceDifference,
    };
  });

  const testProducts = products.slice(0, 2);

  const productGroups = testProducts.reduce((groups, product, index) => {
    const groupIndex = Math.floor(index / chunkSize);

    if (!groups[groupIndex]) {
      groups[groupIndex] = [];
    }
    groups[groupIndex].push(product);

    return groups;
  }, []);
  return productGroups;
};
