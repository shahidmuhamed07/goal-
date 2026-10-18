import { MongoClient, type Db } from 'mongodb';
import { DuplicateError, type ContentStore, type Doc, type Filter, type FindOptions, type StoreCollection } from './store';

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
    // Two accounts cannot share an access code (accounts without one yet are left out of the index).
    await this.db
      .collection('users')
      .createIndex({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } });
    // The lookups the app makes all the time.
    await this.db.collection('users').createIndex({ collaboratorUids: 1 });
    await this.db.collection('goals').createIndex({ userId: 1 });
    await this.db.collection('goals').createIndex({ viewerUids: 1 });
    await this.db.collection('accessRequests').createIndex({ toUid: 1 });
    await this.db.collection('accessRequests').createIndex({ fromUid: 1 });
    await this.db.collection('chats').createIndex({ participantUids: 1 });
    await this.db.collection('messages').createIndex({ chatId: 1, createdAt: 1 });
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

  async find(c: StoreCollection, filter: Filter, options: FindOptions = {}): Promise<Doc[]> {
    // A field holding a list matches when the list contains the value, which is how MongoDB already treats a plain equality.
    let cursor = this.db.collection(c).find(filter as never);
    if (options.sort) {
      const desc = options.sort.startsWith('-');
      cursor = cursor.sort({ [desc ? options.sort.slice(1) : options.sort]: desc ? -1 : 1 });
    }
    if (options.limit) cursor = cursor.limit(options.limit);
    const docs = await cursor.toArray();
    return docs.map(({ _id, ...rest }) => rest as Doc);
  }

  async upsert(c: StoreCollection, doc: Doc) {
    try {
      await this.db.collection(c).replaceOne({ _id: doc.id as never }, { ...doc, _id: doc.id as never }, { upsert: true });
    } catch (e) {
      if (typeof e === 'object' && e && 'code' in e && e.code === DUPLICATE_KEY) {
        const pattern = 'keyPattern' in e && e.keyPattern && typeof e.keyPattern === 'object' ? Object.keys(e.keyPattern) : [];
        throw new DuplicateError(pattern[0] ?? 'slug');
      }
      throw e;
    }
  }

  async remove(c: StoreCollection, id: string) {
    const result = await this.db.collection(c).deleteOne({ _id: id as never });
    return result.deletedCount === 1;
  }
}
