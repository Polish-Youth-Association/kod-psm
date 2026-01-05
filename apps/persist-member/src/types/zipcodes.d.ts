declare module "zipcodes" {
    export type ZipLookupResult = {
      zip: string;
      city: string;
      state: string;
      latitude: number;
      longitude: number;
    };
  
    const zipcodes: {
      lookup(zip: string): ZipLookupResult | null;
    };
  
    export default zipcodes;
  }