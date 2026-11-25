import { Client } from '@elastic/elasticsearch';
import { config } from './config';

export const es = new Client({
  node: config.elasticUrl,
  ...(process.env.ELASTIC_API_KEY ? { auth: { apiKey: process.env.ELASTIC_API_KEY } } : {}),
});
const INDEX = 'emails';

export async function ensureIndex() {
  const exists = await es.indices.exists({ index: INDEX });
  if (!exists) {
    await es.indices.create({
      index: INDEX,
      mappings: {
        properties: {
          user_id: { type: 'integer' },
          to_email: { type: 'text', fields: { raw: { type: 'keyword' } } },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          scheduled_at: { type: 'date' },
          sent_at: { type: 'date' },
        },
      },
    });
  }
}

export async function indexEmails(docs: Record<string, any>[]) {
  if (!docs.length) return;
  try {
    const operations = docs.flatMap((d) => [{ index: { _index: INDEX, _id: String(d.id) } }, d]);
    await es.bulk({ operations });
  } catch (e) {
    console.warn('[ES] bulk index failed:', (e as Error).message); // search is non-critical
  }
}

export async function updateEmailDoc(id: number, doc: Record<string, any>) {
  try {
    await es.update({ index: INDEX, id: String(id), doc });
  } catch (e) {
    console.warn('[ES] update failed:', (e as Error).message);
  }
}

export async function searchEmails(userId: number, q: string, status?: string[]) {
  const filter: any[] = [{ term: { user_id: userId } }];
  if (status?.length) filter.push({ terms: { status } });
  const res = await es.search({
    index: INDEX,
    size: 200,
    sort: [{ scheduled_at: 'desc' }],
    query: {
      bool: {
        filter,
        must: q
          ? [{ multi_match: { query: q, fields: ['to_email', 'subject', 'body'], fuzziness: 'AUTO' } }]
          : [{ match_all: {} }],
      },
    },
  });
  return res.hits.hits.map((h) => h._source);
}
