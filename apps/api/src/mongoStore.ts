import { MongoClient, type Db } from 'mongodb';
import { DuplicateError, type ContentStore, type Doc, type StoreCollection } from './store';

/** MongoDB error code for "a unique index would be violated". */
const DUPLICATE_KEY = 11000;

/** Stores each kind of content in its own MongoDB collection, using our own `id` as `_id`. */
export class MongoStore implements ContentStore {
  private client: MongoClient;
  private db!: Db;

  constructor(
    uri: string,
    private dbName: string,
  ) {
    this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  }

  async ready() {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    // Two pages cannot share an address.
    await this.db.collection('pages').createIndex({ slug: 1 }, { unique: true });
  }

  async close() {
    await this.client.close();
  }

  async list(c: StoreCollection): Promise<Doc[]> {
    const docs = await this.db.collection(c).find({}).sort({ updatedAt: -1, addedAt: -1 }).toArray();
    return docs.map(({ _id, ...rest }) => rest as Doc);
  }

  async get(c: StoreCollection, id: string): Promise<Doc | null> {
    const doc = await this.db.collection(c).findOne({ _id: id as never });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest as Doc;
  }

  async upsert(c: StoreCollection, doc: Doc) {
    try {
      await this.db.collection(c).replaceOne({ _id: doc.id as never }, { ...doc, _id: doc.id as never }, { upsert: true });
    } catch (e) {
      if (typeof e === 'object' && e && 'code' in e && e.code === DUPLICATE_KEY) throw new DuplicateError('slug');
      throw e;
    }
  }

  async remove(c: StoreCollection, id: string) {
    const result = await this.db.collection(c).deleteOne({ _id: id as never });
    return result.deletedCount === 1;
  }
}
