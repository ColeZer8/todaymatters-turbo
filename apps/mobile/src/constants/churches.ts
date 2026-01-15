export interface ChurchOption {
  id: string;
  name: string;
  city: string;
  state: string;
}

/**
 * Starter dataset for type-ahead selection.
 *
 * TODO: Replace with the purchased national dataset (e.g. Barna) and/or a server-fed list.
 */
export const CHURCH_OPTIONS_US_SAMPLE: ChurchOption[] = [
  { id: 'life-church-edmond', name: 'Life.Church', city: 'Edmond', state: 'OK' },
  { id: 'elevation-church', name: 'Elevation Church', city: 'Charlotte', state: 'NC' },
  { id: 'saddleback-church', name: 'Saddleback Church', city: 'Lake Forest', state: 'CA' },
  { id: 'north-point-community-church', name: 'North Point Community Church', city: 'Alpharetta', state: 'GA' },
  { id: 'lakewood-church', name: 'Lakewood Church', city: 'Houston', state: 'TX' },
  { id: 'calvary-chapel-costa-mesa', name: 'Calvary Chapel Costa Mesa', city: 'Costa Mesa', state: 'CA' },
  { id: 'village-church', name: 'The Village Church', city: 'Flower Mound', state: 'TX' },
  { id: 'gateway-church', name: 'Gateway Church', city: 'Southlake', state: 'TX' },
  { id: 'willow-creek-community-church', name: 'Willow Creek Community Church', city: 'South Barrington', state: 'IL' },
  { id: 'mariners-church', name: 'Mariners Church', city: 'Irvine', state: 'CA' },
  { id: 'church-of-the-highlands', name: 'Church of the Highlands', city: 'Birmingham', state: 'AL' },
  { id: 'seacoast-church', name: 'Seacoast Church', city: 'Charleston', state: 'SC' },
  { id: 'christ-fellowship-church', name: 'Christ Fellowship Church', city: 'Palm Beach Gardens', state: 'FL' },
  { id: 'rock-church', name: 'The Rock Church', city: 'San Diego', state: 'CA' },
  { id: 'hillsong-nyc', name: 'Hillsong NYC', city: 'New York', state: 'NY' },
  { id: 'bethel-church-redding', name: 'Bethel Church', city: 'Redding', state: 'CA' },
  { id: 'redeemer-presbyterian', name: 'Redeemer Presbyterian Church', city: 'New York', state: 'NY' },
  { id: 'grace-community-church', name: 'Grace Community Church', city: 'Sun Valley', state: 'CA' },
  { id: 'dallas-first-baptist', name: 'First Baptist Dallas', city: 'Dallas', state: 'TX' },
  { id: 'new-life-church-co', name: 'New Life Church', city: 'Colorado Springs', state: 'CO' },
  { id: 'new-community-church', name: 'New Community Church', city: 'Chicago', state: 'IL' },
  { id: 'park-street-church', name: 'Park Street Church', city: 'Boston', state: 'MA' },
  { id: 'national-community-church', name: 'National Community Church', city: 'Washington', state: 'DC' },
  { id: 'church-of-the-city', name: 'Church of the City', city: 'Nashville', state: 'TN' },
  { id: 'calvary-church-albuquerque', name: 'Calvary Church', city: 'Albuquerque', state: 'NM' },
  { id: 'passion-city-church', name: 'Passion City Church', city: 'Atlanta', state: 'GA' },
  { id: 'harvest-bible-chapel', name: 'Harvest Bible Chapel', city: 'Rolling Meadows', state: 'IL' },
  { id: 'compass-christian-church', name: 'Compass Christian Church', city: 'Chandler', state: 'AZ' },
  { id: 'crossroads-church', name: 'Crossroads Church', city: 'Cincinnati', state: 'OH' },
  { id: 'community-christian-church', name: 'Community Christian Church', city: 'Naperville', state: 'IL' },
  { id: 'brooklyn-tabernacle', name: 'The Brooklyn Tabernacle', city: 'Brooklyn', state: 'NY' },
  { id: 'glide-memorial', name: 'GLIDE Memorial Church', city: 'San Francisco', state: 'CA' },
  { id: 'st-patricks-cathedral', name: "St. Patrick's Cathedral", city: 'New York', state: 'NY' },
  { id: 'church-of-jesus-christ-sl', name: 'The Church of Jesus Christ of Latter-day Saints', city: 'Salt Lake City', state: 'UT' },
  { id: 'st-john-the-divine', name: 'Cathedral of St. John the Divine', city: 'New York', state: 'NY' },
  { id: 'grace-church-houston', name: 'Grace Church', city: 'Houston', state: 'TX' },
  { id: 'first-presbyterian-church', name: 'First Presbyterian Church', city: 'Nashville', state: 'TN' },
  { id: 'citylight-church', name: 'Citylight Church', city: 'Omaha', state: 'NE' },
  { id: 'shoreline-city-church', name: 'Shoreline City Church', city: 'Dallas', state: 'TX' },
  { id: 'bridgeway-church', name: 'Bridgeway Church', city: 'Columbia', state: 'MD' },
  { id: 'fellowship-church', name: 'Fellowship Church', city: 'Grapevine', state: 'TX' },
  { id: 'cornerstone-church', name: 'Cornerstone Church', city: 'San Antonio', state: 'TX' },
  { id: 'transformation-church', name: 'Transformation Church', city: 'Tulsa', state: 'OK' },
  { id: 'hillside-church', name: 'Hillside Church', city: 'Seattle', state: 'WA' },
  { id: 'first-baptist-church', name: 'First Baptist Church', city: 'Orlando', state: 'FL' },
  { id: 'second-baptist-houston', name: 'Second Baptist Church', city: 'Houston', state: 'TX' },
  { id: 'c3-church', name: 'C3 Church', city: 'Los Angeles', state: 'CA' },
  { id: 'vineyard-church', name: 'Vineyard Church', city: 'Columbus', state: 'OH' },
  { id: 'christ-the-king-church', name: 'Christ the King Church', city: 'Tacoma', state: 'WA' },
];

export function formatChurchOptionLabel(option: ChurchOption): string {
  return `${option.name} — ${option.city}, ${option.state}`;
}

