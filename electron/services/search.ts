import https from 'https';
import http from 'http';

/**
 * Search service - PubMed E-utilities, Crossref API, Semantic Scholar API
 */

interface SearchOptions {
  keyword: string;
  sources: string[];
  yearFrom?: number;
  yearTo?: number;
  page?: number;
  pageSize?: number;
}

interface RawSearchResult {
  id: string;
  title: string;
  authors: string[];
  year: number;
  journal: string;
  doi?: string;
  pmid?: string;
  abstract: string;
  source: string;
  citedCount?: number;
}

// Generic HTTP GET with JSON parsing
function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Failed to parse JSON from ${url}`)); }
      });
    }).on('error', reject)
      .on('timeout', function(this: import('http').ClientRequest) { this.destroy(); reject(new Error('Request timeout')); });
  });
}

/**
 * Search PubMed via NCBI E-utilities
 */
async function searchPubMed(options: SearchOptions): Promise<RawSearchResult[]> {
  const { keyword, yearFrom, yearTo, page = 1, pageSize = 20 } = options;

  // Build search query
  let query = keyword;
  if (yearFrom || yearTo) {
    query += ` AND ${yearFrom || 1900}:${yearTo || 2099}[pdat]`;
  }

  // Step 1: Search - get PMIDs
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${pageSize}&retstart=${(page - 1) * pageSize}&retmode=json&sort=relevance`;
  const searchData = await fetchJSON(searchUrl);
  const pmids: string[] = searchData?.esearchresult?.idlist || [];

  if (pmids.length === 0) return [];

  // Step 2: Fetch details
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
  const summaryData = await fetchJSON(summaryUrl);

  // Step 3: Fetch abstracts
  const abstractUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&rettype=abstract&retmode=json`;
  let abstracts: Record<string, string> = {};
  try {
    const abstractData = await fetchJSON(abstractUrl);
    // Parse abstracts from efetch JSON
    if (abstractData?.PubmedArticleList) {
      for (const article of abstractData.PubmedArticleList) {
        const pmid = article.MedlineCitation?.PMID?.['#text'] || article.MedlineCitation?.PMID;
        const abstractTexts = article.MedlineCitation?.Article?.Abstract?.AbstractText;
        if (abstractTexts) {
          abstracts[pmid] = Array.isArray(abstractTexts)
            ? abstractTexts.map((t: any) => t['#text'] || t).join(' ')
            : abstractTexts;
        }
      }
    }
  } catch {
    // Abstracts are optional - don't fail the whole search
  }

  // Map to results
  const results: RawSearchResult[] = [];
  const resultData = summaryData?.result || {};

  for (const pmid of pmids) {
    const item = resultData[pmid];
    if (!item) continue;

    results.push({
      id: `pmid:${pmid}`,
      title: item.title || '',
      authors: (item.authors || []).map((a: any) => a.name || '').filter(Boolean),
      year: item.pubdate ? parseInt(item.pubdate.split(' ')[0], 10) || 0 : 0,
      journal: item.fulljournalname || item.source || '',
      doi: item.elocationid?.startsWith('doi:') ? item.elocationid.replace('doi:', '').trim() : undefined,
      pmid,
      abstract: abstracts[pmid] || '',
      source: 'PubMed',
      citedCount: undefined,
    });
  }

  return results;
}

/**
 * Search Crossref API
 */
async function searchCrossref(options: SearchOptions): Promise<RawSearchResult[]> {
  const { keyword, yearFrom, yearTo, page = 1, pageSize = 20 } = options;

  let query = keyword;
  const params = new URLSearchParams({
    query,
    rows: String(pageSize),
    offset: String((page - 1) * pageSize),
    sort: 'relevance',
  });

  if (yearFrom) params.append('filter', `from-pub-date:${yearFrom}`);
  if (yearTo) params.append('filter', `until-pub-date:${yearTo}`);

  const url = `https://api.crossref.org/works?${params.toString()}`;
  const data = await fetchJSON(url);

  const items = data?.message?.items || [];
  return items.map((item: any, i: number) => ({
    id: `doi:${item.DOI || i}`,
    title: (item.title || ['Untitled'])[0],
    authors: (item.author || []).map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean),
    year: item.published?.['date-parts']?.[0]?.[0] || item.created?.['date-parts']?.[0]?.[0] || 0,
    journal: item['container-title']?.[0] || item['publisher'] || '',
    doi: item.DOI,
    abstract: item.abstract || '',
    source: 'Crossref',
    citedCount: item['is-referenced-by-count'] || 0,
  }));
}

/**
 * Search Semantic Scholar API
 */
async function searchSemanticScholar(options: SearchOptions): Promise<RawSearchResult[]> {
  const { keyword, yearFrom, yearTo, page = 1, pageSize = 20 } = options;

  const params = new URLSearchParams({
    query: keyword,
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
    fields: 'title,authors,year,abstract,citationCount,externalIds,journal',
  });

  if (yearFrom) params.append('year', `${yearFrom}-${yearTo || new Date().getFullYear()}`);

  const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`;
  const data = await fetchJSON(url);

  const items = data?.data || [];
  return items.map((item: any) => ({
    id: `ss:${item.paperId || ''}`,
    title: item.title || '',
    authors: (item.authors || []).map((a: any) => a.name || '').filter(Boolean),
    year: item.year || 0,
    journal: item.journal?.name || '',
    doi: item.externalIds?.DOI,
    pmid: item.externalIds?.PubMed,
    abstract: item.abstract || '',
    source: 'Semantic Scholar',
    citedCount: item.citationCount || 0,
  }));
}

/**
 * Main search function - aggregates results from selected sources
 */
export async function searchPapers(options: SearchOptions): Promise<RawSearchResult[]> {
  const promises: Promise<RawSearchResult[]>[] = [];

  if (options.sources.includes('pubmed')) {
    promises.push(searchPubMed(options).catch(err => {
      console.error('PubMed search failed:', err);
      return [];
    }));
  }
  if (options.sources.includes('crossref')) {
    promises.push(searchCrossref(options).catch(err => {
      console.error('Crossref search failed:', err);
      return [];
    }));
  }
  if (options.sources.includes('semantic-scholar')) {
    promises.push(searchSemanticScholar(options).catch(err => {
      console.error('Semantic Scholar search failed:', err);
      return [];
    }));
  }

  const results = await Promise.all(promises);
  return results.flat();
}

/**
 * Download PDF from Unpaywall (open access)
 */
export async function downloadOpenAccessPDF(doi: string, email: string): Promise<string | null> {
  try {
    const url = `https://api.unpaywall.org/v2/${doi}?email=${email}`;
    const data = await fetchJSON(url);

    const bestOa = data?.best_oa_location;
    if (bestOa?.url_for_pdf) {
      return bestOa.url_for_pdf;
    }
    if (bestOa?.url) {
      return bestOa.url;
    }
    return null;
  } catch (err) {
    console.error('Unpaywall lookup failed:', err);
    return null;
  }
}

/**
 * Save search history to database
 */
export function createSearchHistoryEntry(db: any, keyword: string, sources: string[], resultCount: number): void {
  const id = db.generateId();
  db.prepare('INSERT INTO search_history (id, keyword, sources, result_count) VALUES (?, ?, ?, ?)').run(
    id, keyword, sources.join(','), resultCount
  );
}
