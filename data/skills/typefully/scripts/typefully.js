#!/usr/bin/env node

/**
 * Typefully CLI - Manage social media posts via the Typefully API
 * https://typefully.com/docs/api
 *
 * Ren build: the API key is read from TYPEFULLY_API_KEY (provided by the Ren vault).
 * No config files, no interactive setup.
 *
 * Zero dependencies - uses only Node.js built-in modules.
 */

const fs = require('fs');
const path = require('path');

// Allow overriding API base for tests / self-hosted mocks.
const API_BASE = process.env.TYPEFULLY_API_BASE || 'https://api.typefully.com/v2';

// ============================================================================
// Utilities
// ============================================================================

function output(data) {
  console.log(JSON.stringify(data, null, 2));
}

function error(message, details = {}) {
  output({ error: message, ...details });
  process.exit(1);
}

function requireSocialSetId(providedId) {
  if (providedId) return providedId;
  error('social_set_id is required', {
    hint: 'Pass it positionally or via --social-set-id <id>. Use social-sets:list to find available IDs.',
  });
}

function resolveDraftTarget(positional, commandName) {
  if (positional.length < 2) {
    error('social_set_id and draft_id are required', {
      hint: `Usage: typefully.js ${commandName} <social_set_id> <draft_id>`,
    });
  }
  return { socialSetId: positional[0], draftId: positional[1] };
}

function requireApiKey() {
  const key = process.env.TYPEFULLY_API_KEY;
  if (!key) {
    error('TYPEFULLY_API_KEY is not set', {
      hint: 'Connect a Typefully credential in your Ren vault so it is injected into the skill environment.',
    });
  }
  return key;
}

function extractApiErrorMessage(data) {
  if (!data || typeof data !== 'object') return null;

  if (typeof data.message === 'string' && data.message.trim() !== '') {
    return data.message;
  }

  if (typeof data.error === 'string' && data.error.trim() !== '') {
    return data.error;
  }

  if (data.error && typeof data.error.message === 'string' && data.error.message.trim() !== '') {
    return data.error.message;
  }

  if (Array.isArray(data.errors)) {
    for (const item of data.errors) {
      if (typeof item === 'string' && item.trim() !== '') {
        return item;
      }
      if (item && typeof item.message === 'string' && item.message.trim() !== '') {
        return item.message;
      }
    }
  }

  return null;
}

async function apiRequest(method, endpoint, body = null, opts = {}) {
  const { exitOnError = true } = opts;
  const apiKey = requireApiKey();

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, options);

  let data;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    if (exitOnError) {
      const validationCode = data?.code || data?.error?.code;
      if (response.status === 400 && validationCode === 'VALIDATION_ERROR') {
        const validationMessage = extractApiErrorMessage(data) || 'Request validation failed';
        error(`Validation error: ${validationMessage}`, { response: data });
      }
      error(`HTTP ${response.status}`, { response: data });
    }
    const err = new Error(`HTTP ${response.status}`);
    err.response = data;
    err.status = response.status;
    throw err;
  }

  return data;
}

function parseArgs(args, spec = {}) {
  const result = { _positional: [] };
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (typeof arg !== 'string') {
      error('Invalid argument type', { argument: arg });
    }

    if (arg.startsWith('--')) {
      const rawKey = arg.slice(2);
      const key = rawKey === 'scratchpad' ? 'notes' : rawKey;
      if (spec[key] === 'boolean') {
        result[key] = true;
        i++;
      } else if (i + 1 < args.length && !String(args[i + 1]).startsWith('--')) {
        result[key] = args[i + 1];
        i += 2;
      } else {
        if (rawKey === 'social-set-id' || rawKey === 'social_set_id') {
          error('--social-set-id (or --social_set_id) requires a value');
        }
        error(`${arg} requires a value`);
      }
    } else if (arg === '-f') {
      if (i + 1 < args.length) {
        result.file = args[i + 1];
        i += 2;
      } else {
        error('-f requires a value');
      }
    } else if (arg === '-a') {
      result.append = true;
      i++;
    } else {
      result._positional.push(arg);
      i++;
    }
  }

  return result;
}

function coerceFlagValueToString(value, flagName, { allowEmpty = false } = {}) {
  if (value === true || value == null) {
    error(`${flagName} requires a value`);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    error(`${flagName} must be a string`);
  }
  const str = String(value);
  if (!allowEmpty && str.trim() === '') {
    error(`${flagName} requires a non-empty value`);
  }
  return str;
}

function pushStringFlag(argv, parsed, key, flagName, opts) {
  if (!Object.prototype.hasOwnProperty.call(parsed, key)) return;
  const value = coerceFlagValueToString(parsed[key], flagName, opts);
  argv.push(flagName, value);
}

function getQuotePostUrlFromParsed(parsed) {
  const hasPrimary = Object.prototype.hasOwnProperty.call(parsed, 'quote-post-url');
  const hasAlias = Object.prototype.hasOwnProperty.call(parsed, 'quote-url');

  if (!hasPrimary && !hasAlias) return null;

  const primary = hasPrimary
    ? coerceFlagValueToString(parsed['quote-post-url'], '--quote-post-url')
    : null;
  const alias = hasAlias
    ? coerceFlagValueToString(parsed['quote-url'], '--quote-url')
    : null;

  if (primary && alias && primary !== alias) {
    error('Conflicting quote post URL values', {
      '--quote-post-url': primary,
      '--quote-url': alias,
    });
  }

  return primary || alias;
}

function addQuotePostUrl(posts, quotePostUrl) {
  if (!quotePostUrl) return posts;
  return posts.map(post => ({ ...post, quote_post_url: quotePostUrl }));
}

function getXContentDisclosuresFromParsed(parsed) {
  const paidPartnership = Boolean(parsed['paid-partnership'] || parsed.paid_partnership);
  const madeWithAi = Boolean(parsed['made-with-ai'] || parsed.made_with_ai);

  return {
    paidPartnership,
    madeWithAi,
    hasAny: paidPartnership || madeWithAi,
  };
}

function addXContentDisclosures(posts, disclosures) {
  if (!disclosures.hasAny) return posts;
  return posts.map(post => {
    const updated = { ...post };
    if (disclosures.paidPartnership) {
      updated.paid_partnership = true;
    }
    if (disclosures.madeWithAi) {
      updated.made_with_ai = true;
    }
    return updated;
  });
}

function validateXOnlyPostOptions(platformList, { quotePostUrl, disclosures }) {
  if ((quotePostUrl || disclosures.hasAny) && !platformList.includes('x')) {
    if (quotePostUrl) {
      error('--quote-post-url is only supported for X posts. Include x in --platform or remove the quote flag.');
    }
    error('--paid-partnership/--made-with-ai is only supported for X posts. Include x in --platform or remove the X-only flag.');
  }
}

function parseCsvArg(value, flagName) {
  if (value === true) {
    error(`${flagName} requires a value`);
  }
  if (value == null) return null;
  if (typeof value !== 'string') {
    error(`${flagName} must be a string`);
  }
  if (value.trim() === '') return [];
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function getSocialSetIdFromParsed(parsed) {
  const value = parsed['social-set-id'] ?? parsed.social_set_id;
  if (value === true) {
    error('--social-set-id (or --social_set_id) requires a value');
  }
  if (value == null) return null;
  if (typeof value !== 'string') {
    error('--social-set-id (or --social_set_id) must be a string');
  }
  if (value.trim() === '') {
    error('--social-set-id (or --social_set_id) requires a non-empty value');
  }
  return value;
}

function getRequiredStringArgFromParsed(parsed, key, aliases = []) {
  const candidates = [key, ...aliases];
  let value = null;

  for (const candidate of candidates) {
    if (!Object.prototype.hasOwnProperty.call(parsed, candidate)) continue;
    value = parsed[candidate];
    break;
  }

  const preferred = `--${key}`;
  const aliasText = aliases.length > 0
    ? ` (or ${aliases.map(a => `--${a}`).join(', ')})`
    : '';

  if (value == null) {
    error(`${preferred}${aliasText} is required`);
  }
  if (value === true) {
    error(`${preferred}${aliasText} requires a value`);
  }
  if (typeof value !== 'string') {
    error(`${preferred}${aliasText} must be a string`);
  }
  if (value.trim() === '') {
    error(`${preferred}${aliasText} requires a non-empty value`);
  }

  return String(value);
}

function getOptionalStringArgFromParsed(parsed, key, aliases = []) {
  const candidates = [key, ...aliases];

  for (const candidate of candidates) {
    if (!Object.prototype.hasOwnProperty.call(parsed, candidate)) continue;

    const value = parsed[candidate];
    const preferred = `--${key}`;
    const aliasText = aliases.length > 0
      ? ` (or ${aliases.map(a => `--${a}`).join(', ')})`
      : '';

    if (value === true) {
      error(`${preferred}${aliasText} requires a value`);
    }
    if (typeof value !== 'string') {
      error(`${preferred}${aliasText} must be a string`);
    }
    if (value.trim() === '') {
      error(`${preferred}${aliasText} requires a non-empty value`);
    }

    return String(value);
  }

  return null;
}

function resolveSocialSetIdFromParsed(parsed, positionalId) {
  const flagId = getSocialSetIdFromParsed(parsed);
  if (flagId && positionalId && flagId !== positionalId) {
    error('Conflicting social_set_id values', { positional: positionalId, flag: flagId });
  }
  return requireSocialSetId(flagId || positionalId);
}

function resolveDraftTargetFromParsed(parsed, commandName) {
  const positional = parsed._positional;
  const flagId = getSocialSetIdFromParsed(parsed);

  if (flagId) {
    if (positional.length >= 2 && positional[0] !== flagId) {
      error('Conflicting social_set_id values', { positional: positional[0], flag: flagId });
    }
    const draftId = positional.length >= 2 ? positional[1] : positional[0];
    if (!draftId) {
      error('draft_id is required');
    }
    return { socialSetId: flagId, draftId };
  }

  return resolveDraftTarget(positional, commandName);
}

function splitThreadText(text) {
  return text.split(/\r?\n[ \t]*---[ \t]*\r?\n/).filter(t => t.trim());
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeFilename(filename) {
  // API pattern: (?i)^[a-zA-Z0-9_.()\\-]+\\.(jpg|jpeg|png|webp|gif|mp4|mov|pdf)$
  const ext = path.extname(filename).toLowerCase();
  const basename = path.basename(filename, path.extname(filename));

  const sanitized = basename
    .replace(/[^a-zA-Z0-9_.()-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const finalName = sanitized || 'upload';

  return finalName + ext;
}

// ============================================================================
// Commands
// ============================================================================

async function cmdMeGet() {
  const data = await apiRequest('GET', '/me');
  output(data);
}

async function cmdSocialSetsList() {
  const data = await apiRequest('GET', '/social-sets?limit=50');
  output(data);
}

async function cmdSocialSetsGet(args) {
  const parsed = parseArgs(args);
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);

  const data = await apiRequest('GET', `/social-sets/${socialSetId}`);
  output(data);
}

async function cmdLinkedInOrganizationsResolve(args) {
  const parsed = parseArgs(args);
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);
  const organizationUrl = getRequiredStringArgFromParsed(
    parsed,
    'organization-url',
    ['organization_url', 'url']
  );

  const params = new URLSearchParams();
  params.set('organization_url', organizationUrl);

  const data = await apiRequest(
    'GET',
    `/social-sets/${socialSetId}/linkedin/organizations/resolve?${params}`
  );
  output(data);
}

async function cmdAnalyticsPostsList(args) {
  const parsed = parseArgs(args, { 'include-replies': 'boolean', 'include_replies': 'boolean' });
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);
  const startDate = getRequiredStringArgFromParsed(parsed, 'start-date', ['start_date']);
  const endDate = getRequiredStringArgFromParsed(parsed, 'end-date', ['end_date']);
  const platform = (parsed.platform
    ? coerceFlagValueToString(parsed.platform, '--platform')
    : 'x').toLowerCase();
  const includeReplies = Boolean(parsed['include-replies'] || parsed.include_replies);

  if (platform !== 'x') {
    error('Only X analytics are currently supported by the Typefully API', {
      provided_platform: platform,
      hint: 'Use --platform x or omit the flag',
    });
  }

  const params = new URLSearchParams();
  params.set('start_date', startDate);
  params.set('end_date', endDate);
  if (parsed.limit) params.set('limit', parsed.limit);
  if (parsed.offset) params.set('offset', parsed.offset);
  if (includeReplies) params.set('include_replies', 'true');

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/analytics/${platform}/posts?${params}`);
  output(data);
}

async function cmdAnalyticsFollowersGet(args) {
  const parsed = parseArgs(args);
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);
  const platform = (parsed.platform
    ? coerceFlagValueToString(parsed.platform, '--platform')
    : 'x').toLowerCase();
  const startDate = getOptionalStringArgFromParsed(parsed, 'start-date', ['start_date']);
  const endDate = getOptionalStringArgFromParsed(parsed, 'end-date', ['end_date']);

  if (platform !== 'x') {
    error('Only X analytics are currently supported by the Typefully API', {
      provided_platform: platform,
      hint: 'Use --platform x or omit the flag',
    });
  }

  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  const query = params.toString();
  const endpoint = `/social-sets/${socialSetId}/analytics/${platform}/followers${query ? `?${query}` : ''}`;

  const data = await apiRequest('GET', endpoint);
  output(data);
}

async function cmdDraftsList(args) {
  const parsed = parseArgs(args);
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);

  const params = new URLSearchParams();
  params.set('limit', parsed.limit || '10');
  if (parsed.status) params.set('status', parsed.status);
  if (parsed.tag) params.set('tag', parsed.tag);
  if (parsed.sort) params.set('order_by', parsed.sort);

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/drafts?${params}`);
  output(data);
}

async function cmdDraftsGet(args) {
  const parsed = parseArgs(args, {
    'exclude-comment-markers': 'boolean',
    exclude_comment_markers: 'boolean',
  });
  const { socialSetId, draftId } = resolveDraftTargetFromParsed(parsed, 'drafts:get');

  const params = new URLSearchParams();
  if (parsed['exclude-comment-markers'] || parsed.exclude_comment_markers) {
    params.set('exclude_comment_markers', 'true');
  }
  const qs = params.toString();
  const url = qs
    ? `/social-sets/${socialSetId}/drafts/${draftId}?${qs}`
    : `/social-sets/${socialSetId}/drafts/${draftId}`;

  const data = await apiRequest('GET', url);
  output(data);
}

async function getFirstConnectedPlatform(socialSetId) {
  const socialSet = await apiRequest('GET', `/social-sets/${socialSetId}`);

  const platformOrder = ['x', 'linkedin', 'threads', 'bluesky', 'mastodon'];
  const platforms = socialSet.platforms || {};

  for (const platform of platformOrder) {
    if (platforms[platform]) {
      return platform;
    }
  }

  return null;
}

async function getAllConnectedPlatforms(socialSetId) {
  const socialSet = await apiRequest('GET', `/social-sets/${socialSetId}`);
  const platformOrder = ['x', 'linkedin', 'threads', 'bluesky', 'mastodon'];
  const platforms = socialSet.platforms || {};
  const connected = [];

  for (const platform of platformOrder) {
    if (platforms[platform]) {
      connected.push(platform);
    }
  }

  return connected;
}

async function cmdDraftsCreate(args) {
  const parsed = parseArgs(args, {
    share: 'boolean',
    all: 'boolean',
    'paid-partnership': 'boolean',
    paid_partnership: 'boolean',
    'made-with-ai': 'boolean',
    made_with_ai: 'boolean',
  });
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);
  const quotePostUrl = getQuotePostUrlFromParsed(parsed);
  const xContentDisclosures = getXContentDisclosuresFromParsed(parsed);

  let text = parsed.text;
  if (parsed.file) {
    if (!fs.existsSync(parsed.file)) {
      error(`File not found: ${parsed.file}`);
    }
    text = fs.readFileSync(parsed.file, 'utf-8');
  }

  if (!text) {
    error('--text or --file is required');
  }

  let platforms = parsed.platform;

  if (parsed.all && parsed.platform) {
    error('Cannot use both --all and --platform flags');
  }

  if (parsed.all) {
    const allPlatforms = await getAllConnectedPlatforms(socialSetId);
    if (allPlatforms.length === 0) {
      error('No connected platforms found. Connect a platform at typefully.com');
    }
    platforms = allPlatforms.join(',');
  } else if (!platforms) {
    const defaultPlatform = await getFirstConnectedPlatform(socialSetId);
    if (!defaultPlatform) {
      error('No connected platforms found. Connect a platform at typefully.com or specify --platform');
    }
    platforms = defaultPlatform;
  }

  const platformList = platforms.split(',').map(p => p.trim());
  validateXOnlyPostOptions(platformList, {
    quotePostUrl,
    disclosures: xContentDisclosures,
  });

  const posts = splitThreadText(text);

  const mediaIds = parsed.media ? parsed.media.split(',').map(m => m.trim()) : [];

  const basePostsArray = posts.map((postText, index) => {
    const post = { text: postText };
    if (index === 0 && mediaIds.length > 0) {
      post.media_ids = mediaIds;
    }
    return post;
  });

  const platformsObj = {};
  for (const platform of platformList) {
    const postsArray = platform === 'x'
      ? addXContentDisclosures(addQuotePostUrl(basePostsArray, quotePostUrl), xContentDisclosures)
      : basePostsArray;
    const platformConfig = {
      enabled: true,
      posts: postsArray,
    };

    if (platform === 'x' && (parsed['reply-to'] || parsed.community)) {
      platformConfig.settings = {};
      if (parsed['reply-to']) {
        platformConfig.settings.reply_to_url = parsed['reply-to'];
      }
      if (parsed.community) {
        platformConfig.settings.community_id = parsed.community;
      }
    }

    platformsObj[platform] = platformConfig;
  }

  const body = { platforms: platformsObj };

  if (parsed.title) {
    body.draft_title = parsed.title;
  }

  if (parsed.schedule) {
    body.publish_at = parsed.schedule;
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'tags')) {
    body.tags = parseCsvArg(parsed.tags, '--tags');
  }

  if (parsed.share) {
    body.share = true;
  }

  if (parsed.notes) {
    body.scratchpad_text = parsed.notes;
  }

  const data = await apiRequest('POST', `/social-sets/${socialSetId}/drafts`, body);
  output(data);
}

async function cmdDraftsUpdate(args) {
  const parsed = parseArgs(args, {
    append: 'boolean',
    share: 'boolean',
    'paid-partnership': 'boolean',
    paid_partnership: 'boolean',
    'made-with-ai': 'boolean',
    made_with_ai: 'boolean',
    'exclude-comment-markers': 'boolean',
    exclude_comment_markers: 'boolean',
    'force-overwrite-comments': 'boolean',
    force_overwrite_comments: 'boolean',
  });
  const { socialSetId, draftId } = resolveDraftTargetFromParsed(parsed, 'drafts:update');
  const quotePostUrl = getQuotePostUrlFromParsed(parsed);
  const xContentDisclosures = getXContentDisclosuresFromParsed(parsed);

  let text = parsed.text;
  if (parsed.file) {
    if (!fs.existsSync(parsed.file)) {
      error(`File not found: ${parsed.file}`);
    }
    text = fs.readFileSync(parsed.file, 'utf-8');
  }

  const body = {};

  const shouldUpdatePosts = Boolean(text || quotePostUrl || xContentDisclosures.hasAny);
  if (shouldUpdatePosts) {
    const explicitPlatformList = parsed.platform
      ? parsed.platform.split(',').map(p => p.trim())
      : null;
    if (explicitPlatformList) {
      validateXOnlyPostOptions(explicitPlatformList, {
        quotePostUrl,
        disclosures: xContentDisclosures,
      });
    }

    const mediaIds = parsed.media ? parsed.media.split(',').map(m => m.trim()) : [];

    const existing = await apiRequest('GET', `/social-sets/${socialSetId}/drafts/${draftId}`);

    let platformList;
    if (explicitPlatformList) {
      platformList = explicitPlatformList;
    } else {
      platformList = Object.entries(existing.platforms || {})
        .filter(([, config]) => config.enabled)
        .map(([platform]) => platform);

      if (platformList.length === 0) {
        const defaultPlatform = await getFirstConnectedPlatform(socialSetId);
        if (!defaultPlatform) {
          error('No connected platforms found. Connect a platform at typefully.com or specify --platform');
        }
        platformList = [defaultPlatform];
      }
    }

    validateXOnlyPostOptions(platformList, {
      quotePostUrl,
      disclosures: xContentDisclosures,
    });

    let postsArray;

    if (text) {
      if (parsed.append) {
        let existingPosts = [];
        for (const [, config] of Object.entries(existing.platforms || {})) {
          if (config.enabled && config.posts) {
            existingPosts = config.posts;
            break;
          }
        }

        const newPost = { text };
        if (mediaIds.length > 0) {
          newPost.media_ids = mediaIds;
        }
        postsArray = [...existingPosts, newPost];
      } else {
        const posts = splitThreadText(text);
        postsArray = posts.map((postText, index) => {
          const post = { text: postText };
          if (index === 0 && mediaIds.length > 0) {
            post.media_ids = mediaIds;
          }
          return post;
        });
      }
    } else {
      // X-only metadata update: preserve existing X posts and add quote/disclosure attrs.
      const existingXPosts = existing.platforms?.x?.posts;
      if (!Array.isArray(existingXPosts) || existingXPosts.length === 0) {
        if (quotePostUrl && !xContentDisclosures.hasAny) {
          error('Cannot apply --quote-post-url because this draft has no existing X posts');
        }
        error('Cannot apply X-only post options because this draft has no existing X posts');
      }
      postsArray = existingXPosts;
      platformList = ['x'];
    }

    const platformsObj = {};
    for (const p of platformList) {
      const platformPosts = p === 'x'
        ? addXContentDisclosures(addQuotePostUrl(postsArray, quotePostUrl), xContentDisclosures)
        : postsArray;
      platformsObj[p] = {
        enabled: true,
        posts: platformPosts,
      };
    }
    body.platforms = platformsObj;
  }

  if (parsed.title) {
    body.draft_title = parsed.title;
  }

  if (parsed.schedule) {
    body.publish_at = parsed.schedule;
  }

  if (parsed.share) {
    body.share = true;
  }

  if (parsed.notes) {
    body.scratchpad_text = parsed.notes;
  }

  if (Object.prototype.hasOwnProperty.call(parsed, 'tags')) {
    body.tags = parseCsvArg(parsed.tags, '--tags');
  }

  if (parsed['force-overwrite-comments'] || parsed.force_overwrite_comments) {
    body.force_overwrite_comments = true;
  }

  if (Object.keys(body).length === 0) {
    error('At least one of --text, --file, --title, --schedule, --share, --notes, --tags, --quote-post-url, --paid-partnership, --made-with-ai, or --force-overwrite-comments is required');
  }

  const params = new URLSearchParams();
  if (parsed['exclude-comment-markers'] || parsed.exclude_comment_markers) {
    params.set('exclude_comment_markers', 'true');
  }
  const qs = params.toString();
  const url = qs
    ? `/social-sets/${socialSetId}/drafts/${draftId}?${qs}`
    : `/social-sets/${socialSetId}/drafts/${draftId}`;

  const data = await apiRequest('PATCH', url, body);
  output(data);
}

// ---------------------------------------------------------------------------
// Aliases (human/agent-friendly)
// ---------------------------------------------------------------------------

async function cmdCreateDraftAlias(args) {
  const parsed = parseArgs(args, {
    share: 'boolean',
    all: 'boolean',
    'paid-partnership': 'boolean',
    paid_partnership: 'boolean',
    'made-with-ai': 'boolean',
    made_with_ai: 'boolean',
  });
  const socialSetId = requireSocialSetId(getSocialSetIdFromParsed(parsed));

  const forwarded = [String(socialSetId)];

  if (Object.prototype.hasOwnProperty.call(parsed, 'file')) {
    forwarded.push('--file', coerceFlagValueToString(parsed.file, '--file'));
  } else {
    let text;
    if (Object.prototype.hasOwnProperty.call(parsed, 'text')) {
      text = coerceFlagValueToString(parsed.text, '--text');
    } else {
      if (parsed._positional.length === 0) {
        error('Draft text is required (provide it as the first argument, or use --text/--file)');
      }
      text = parsed._positional.join(' ');
    }
    forwarded.push('--text', text);
  }

  pushStringFlag(forwarded, parsed, 'platform', '--platform');
  if (parsed.all) forwarded.push('--all');
  pushStringFlag(forwarded, parsed, 'media', '--media');
  pushStringFlag(forwarded, parsed, 'title', '--title');
  pushStringFlag(forwarded, parsed, 'schedule', '--schedule');
  pushStringFlag(forwarded, parsed, 'tags', '--tags', { allowEmpty: true });
  pushStringFlag(forwarded, parsed, 'reply-to', '--reply-to');
  pushStringFlag(forwarded, parsed, 'community', '--community');
  const quotePostUrl = getQuotePostUrlFromParsed(parsed);
  if (quotePostUrl) forwarded.push('--quote-post-url', quotePostUrl);
  if (parsed['paid-partnership'] || parsed.paid_partnership) forwarded.push('--paid-partnership');
  if (parsed['made-with-ai'] || parsed.made_with_ai) forwarded.push('--made-with-ai');
  if (parsed.share) forwarded.push('--share');
  pushStringFlag(forwarded, parsed, 'notes', '--notes');

  await cmdDraftsCreate(forwarded);
}

async function cmdUpdateDraftAlias(args) {
  const parsed = parseArgs(args, {
    append: 'boolean',
    share: 'boolean',
    'paid-partnership': 'boolean',
    paid_partnership: 'boolean',
    'made-with-ai': 'boolean',
    made_with_ai: 'boolean',
  });
  const socialSetId = requireSocialSetId(getSocialSetIdFromParsed(parsed));

  if (parsed._positional.length === 0) {
    error('draft_id is required');
  }
  const draftId = parsed._positional[0];

  let text;
  if (Object.prototype.hasOwnProperty.call(parsed, 'text')) {
    text = coerceFlagValueToString(parsed.text, '--text');
  } else if (!Object.prototype.hasOwnProperty.call(parsed, 'file') && parsed._positional.length > 1) {
    text = parsed._positional.slice(1).join(' ');
  }

  const forwarded = [String(socialSetId), String(draftId)];
  pushStringFlag(forwarded, parsed, 'platform', '--platform');
  if (text) forwarded.push('--text', text);
  if (Object.prototype.hasOwnProperty.call(parsed, 'file')) {
    forwarded.push('--file', coerceFlagValueToString(parsed.file, '--file'));
  }
  pushStringFlag(forwarded, parsed, 'media', '--media');
  if (parsed.append) forwarded.push('--append');
  pushStringFlag(forwarded, parsed, 'title', '--title');
  pushStringFlag(forwarded, parsed, 'schedule', '--schedule');
  pushStringFlag(forwarded, parsed, 'tags', '--tags', { allowEmpty: true });
  const quotePostUrl = getQuotePostUrlFromParsed(parsed);
  if (quotePostUrl) forwarded.push('--quote-post-url', quotePostUrl);
  if (parsed['paid-partnership'] || parsed.paid_partnership) forwarded.push('--paid-partnership');
  if (parsed['made-with-ai'] || parsed.made_with_ai) forwarded.push('--made-with-ai');
  if (parsed.share) forwarded.push('--share');
  pushStringFlag(forwarded, parsed, 'notes', '--notes');

  await cmdDraftsUpdate(forwarded);
}

async function cmdDraftsDelete(args) {
  const parsed = parseArgs(args);
  const { socialSetId, draftId } = resolveDraftTargetFromParsed(parsed, 'drafts:delete');

  await apiRequest('DELETE', `/social-sets/${socialSetId}/drafts/${draftId}`);
  output({ success: true, message: 'Draft deleted' });
}

async function cmdDraftsSchedule(args) {
  const parsed = parseArgs(args);
  const { socialSetId, draftId } = resolveDraftTargetFromParsed(parsed, 'drafts:schedule');

  if (!parsed.time) {
    error('--time is required (use "next-free-slot" or ISO datetime)');
  }

  const data = await apiRequest('PATCH', `/social-sets/${socialSetId}/drafts/${draftId}`, {
    publish_at: parsed.time,
  });
  output(data);
}

async function cmdDraftsPublish(args) {
  const parsed = parseArgs(args);
  const { socialSetId, draftId } = resolveDraftTargetFromParsed(parsed, 'drafts:publish');

  const data = await apiRequest('PATCH', `/social-sets/${socialSetId}/drafts/${draftId}`, {
    publish_at: 'now',
  });
  output(data);
}

// ---------------------------------------------------------------------------
// Comments (per-draft comment threads)
// ---------------------------------------------------------------------------

function requireDraftIdPositional(parsed, commandName) {
  const positional = parsed._positional;
  if (positional.length === 0) {
    error(`draft_id is required`, {
      hint: `Usage: typefully.js ${commandName} <draft_id> --social-set-id <id>`,
    });
  }
  const socialSetId = requireSocialSetId(getSocialSetIdFromParsed(parsed));
  return { socialSetId, draftId: positional[0] };
}

function requireThreadPositional(parsed, commandName) {
  const positional = parsed._positional;
  if (positional.length < 2) {
    error('draft_id and thread_id are required', {
      hint: `Usage: typefully.js ${commandName} <draft_id> <thread_id> --social-set-id <id>`,
    });
  }
  const socialSetId = requireSocialSetId(getSocialSetIdFromParsed(parsed));
  return { socialSetId, draftId: positional[0], threadId: positional[1] };
}

function requireCommentPositional(parsed, commandName) {
  const positional = parsed._positional;
  if (positional.length < 3) {
    error('draft_id, thread_id, and comment_id are required', {
      hint: `Usage: typefully.js ${commandName} <draft_id> <thread_id> <comment_id> --social-set-id <id>`,
    });
  }
  const socialSetId = requireSocialSetId(getSocialSetIdFromParsed(parsed));
  return {
    socialSetId,
    draftId: positional[0],
    threadId: positional[1],
    commentId: positional[2],
  };
}

async function cmdCommentsList(args) {
  const parsed = parseArgs(args);
  const { socialSetId, draftId } = requireDraftIdPositional(parsed, 'comments:list');

  const params = new URLSearchParams();
  if (parsed.platform) params.set('platform', parsed.platform);
  if (parsed.status) params.set('status', parsed.status);
  params.set('limit', parsed.limit || '10');
  if (parsed.offset) params.set('offset', parsed.offset);

  const data = await apiRequest(
    'GET',
    `/social-sets/${socialSetId}/drafts/${draftId}/comment-threads?${params}`,
  );
  output(data);
}

async function cmdCommentsCreate(args) {
  const parsed = parseArgs(args);
  const { socialSetId, draftId } = requireDraftIdPositional(parsed, 'comments:create');

  const text = getRequiredStringArgFromParsed(parsed, 'text');
  const selectedText = getRequiredStringArgFromParsed(parsed, 'selected-text', ['selected_text']);
  const postIndexRaw = getRequiredStringArgFromParsed(parsed, 'post-index', ['post_index']);
  const postIndex = Number.parseInt(postIndexRaw, 10);
  if (!Number.isInteger(postIndex) || postIndex < 0) {
    error('--post-index must be a non-negative integer');
  }

  const body = {
    post_index: postIndex,
    selected_text: selectedText,
    text,
  };

  if (parsed.platform) body.platform = parsed.platform;
  if (Object.prototype.hasOwnProperty.call(parsed, 'occurrence')) {
    const occurrence = Number.parseInt(parsed.occurrence, 10);
    if (!Number.isInteger(occurrence) || occurrence < 0) {
      error('--occurrence must be a non-negative integer');
    }
    body.occurrence = occurrence;
  }

  const data = await apiRequest(
    'POST',
    `/social-sets/${socialSetId}/drafts/${draftId}/comment-threads`,
    body,
  );
  output(data);
}

async function cmdCommentsReply(args) {
  const parsed = parseArgs(args);
  const { socialSetId, draftId, threadId } = requireThreadPositional(parsed, 'comments:reply');
  const text = getRequiredStringArgFromParsed(parsed, 'text');

  const data = await apiRequest(
    'POST',
    `/social-sets/${socialSetId}/drafts/${draftId}/comment-threads/${threadId}/comments`,
    { text },
  );
  output(data);
}

async function cmdCommentsResolve(args) {
  const parsed = parseArgs(args);
  const { socialSetId, draftId, threadId } = requireThreadPositional(parsed, 'comments:resolve');

  const data = await apiRequest(
    'POST',
    `/social-sets/${socialSetId}/drafts/${draftId}/comment-threads/${threadId}/resolve`,
  );
  output(data);
}

async function cmdCommentsUpdate(args) {
  const parsed = parseArgs(args);
  const { socialSetId, draftId, threadId, commentId } = requireCommentPositional(
    parsed,
    'comments:update',
  );
  const text = getRequiredStringArgFromParsed(parsed, 'text');

  const data = await apiRequest(
    'PATCH',
    `/social-sets/${socialSetId}/drafts/${draftId}/comment-threads/${threadId}/comments/${commentId}`,
    { text },
  );
  output(data);
}

async function cmdCommentsDelete(args) {
  const parsed = parseArgs(args);
  const positional = parsed._positional;

  if (positional.length < 2) {
    error('draft_id and thread_id are required', {
      hint: 'Usage: typefully.js comments:delete <draft_id> <thread_id> [comment_id] --social-set-id <id>',
    });
  }
  const socialSetId = requireSocialSetId(getSocialSetIdFromParsed(parsed));
  const draftId = positional[0];
  const threadId = positional[1];
  const commentId = positional[2] || null;

  const url = commentId
    ? `/social-sets/${socialSetId}/drafts/${draftId}/comment-threads/${threadId}/comments/${commentId}`
    : `/social-sets/${socialSetId}/drafts/${draftId}/comment-threads/${threadId}`;

  await apiRequest('DELETE', url);
  output({
    success: true,
    message: commentId ? 'Comment deleted' : 'Comment thread deleted',
  });
}

async function cmdQueueGet(args) {
  const parsed = parseArgs(args);
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);
  const startDate = getRequiredStringArgFromParsed(parsed, 'start-date', ['start_date']);
  const endDate = getRequiredStringArgFromParsed(parsed, 'end-date', ['end_date']);

  const params = new URLSearchParams();
  params.set('start_date', startDate);
  params.set('end_date', endDate);

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/queue?${params}`);
  output(data);
}

async function cmdQueueScheduleGet(args) {
  const parsed = parseArgs(args);
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/queue/schedule`);
  output(data);
}

async function cmdQueueSchedulePut(args) {
  const parsed = parseArgs(args);
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);
  const rawRules = getRequiredStringArgFromParsed(parsed, 'rules');

  let rules;
  try {
    rules = JSON.parse(rawRules);
  } catch {
    error('--rules must be valid JSON');
  }

  if (!Array.isArray(rules)) {
    error('--rules must be a JSON array');
  }

  const data = await apiRequest('PUT', `/social-sets/${socialSetId}/queue/schedule`, { rules });
  output(data);
}

async function cmdTagsList(args) {
  const parsed = parseArgs(args);
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/tags?limit=50`);
  output(data);
}

async function cmdTagsCreate(args) {
  const parsed = parseArgs(args);
  const socialSetId = resolveSocialSetIdFromParsed(parsed, parsed._positional[0]);

  if (!parsed.name) {
    error('--name is required');
  }

  const data = await apiRequest('POST', `/social-sets/${socialSetId}/tags`, {
    name: parsed.name,
  });
  output(data);
}

async function cmdMediaUpload(args) {
  const parsed = parseArgs(args, { 'no-wait': 'boolean' });
  const positional = parsed._positional;

  let socialSetId, filePath;
  const socialSetIdFlag = getSocialSetIdFromParsed(parsed);
  if (positional.length >= 2) {
    if (socialSetIdFlag && positional[0] !== socialSetIdFlag) {
      error('Conflicting social_set_id values', { positional: positional[0], flag: socialSetIdFlag });
    }
    socialSetId = socialSetIdFlag || positional[0];
    filePath = positional[1];
  } else if (positional.length === 1) {
    filePath = positional[0];
    socialSetId = requireSocialSetId(socialSetIdFlag);
  } else {
    error('file path is required');
  }

  if (!fs.existsSync(filePath)) {
    error(`File not found: ${filePath}`);
  }

  const rawFilename = path.basename(filePath);
  const filename = sanitizeFilename(rawFilename);
  const timeout = parseInt(parsed.timeout || '60', 10) * 1000;
  const pollIntervalMs = (() => {
    const raw = process.env.TYPEFULLY_MEDIA_POLL_INTERVAL_MS;
    if (!raw) return 2000;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 2000;
  })();

  const presignedResponse = await apiRequest('POST', `/social-sets/${socialSetId}/media/upload`, {
    file_name: filename,
  });

  const { upload_url: uploadUrl, media_id: mediaId } = presignedResponse;

  if (!uploadUrl) {
    error('Failed to get presigned URL', { response: presignedResponse });
  }

  // S3 presigned URLs encode Content-Type — do not set it on the PUT.
  const fileBuffer = fs.readFileSync(filePath);

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    error('Failed to upload file to S3', {
      http_code: uploadResponse.status,
      status_text: uploadResponse.statusText,
    });
  }

  if (parsed['no-wait']) {
    output({
      media_id: mediaId,
      message: 'Upload complete. Use media:status to check processing.',
    });
    return;
  }

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const statusResponse = await apiRequest('GET', `/social-sets/${socialSetId}/media/${mediaId}`);

    if (statusResponse.status === 'ready') {
      output({
        media_id: mediaId,
        status: statusResponse.status,
        message: 'Media uploaded and ready to use',
      });
      return;
    }

    if (statusResponse.status === 'error' || statusResponse.status === 'failed') {
      error('Media processing failed', { status: statusResponse });
    }

    await sleep(pollIntervalMs);
  }

  output({
    media_id: mediaId,
    status: 'processing',
    message: 'Upload complete but still processing. Use media:status to check.',
    hint: 'Increase timeout with --timeout <seconds>',
  });
}

async function cmdMediaStatus(args) {
  const parsed = parseArgs(args);
  const positional = parsed._positional;

  let socialSetId, mediaId;
  const socialSetIdFlag = getSocialSetIdFromParsed(parsed);
  if (positional.length >= 2) {
    if (socialSetIdFlag && positional[0] !== socialSetIdFlag) {
      error('Conflicting social_set_id values', { positional: positional[0], flag: socialSetIdFlag });
    }
    socialSetId = socialSetIdFlag || positional[0];
    mediaId = positional[1];
  } else if (positional.length === 1) {
    mediaId = positional[0];
    socialSetId = requireSocialSetId(socialSetIdFlag);
  } else {
    error('media_id is required');
  }

  const data = await apiRequest('GET', `/social-sets/${socialSetId}/media/${mediaId}`);
  output(data);
}

function showHelp() {
  console.log(`Typefully CLI - Manage social media posts via the Typefully API

AUTH:
  Reads TYPEFULLY_API_KEY from the environment (injected by the Ren vault).

USAGE:
  typefully.js <command> [arguments]

NOTE:
  Commands that take a social_set_id as a positional argument also accept:
    --social-set-id <id>   (or --social_set_id <id>)

COMMANDS:
  me:get                                     Get authenticated user info

  social-sets:list                           List all social sets
  social-sets:get <social_set_id>            Get social set details with platforms
  linkedin:organizations:resolve <social_set_id> --organization-url <url>
                                             Resolve LinkedIn org URL into mention syntax

  analytics:posts:list <social_set_id> [options]
                                             List X post analytics for a date range
    --platform <platform>                    Platform (default: x; only x supported)
    --start-date <YYYY-MM-DD>                Inclusive start date (required)
    --end-date <YYYY-MM-DD>                  Inclusive end date (required)
    --include-replies                        Include X replies (excluded by default)
    --limit <n>, --offset <n>                Pagination
  analytics:followers:get <social_set_id> [options]
                                             Daily X follower counts
    --start-date / --end-date                Optional inclusive range

  drafts:list <social_set_id> [options]      List drafts
    --status <status>                        draft / scheduled / published / error / publishing
    --tag <tag_slug>                         Filter by tag slug
    --sort <order>                           created_at, -created_at, scheduled_date, ...
    --limit <n>                              Max results (default: 10, max: 50)

  drafts:get <social_set_id> <draft_id>      Get a specific draft
    --exclude-comment-markers                Strip <typ:comment-thread> markers (display only)

  drafts:create <social_set_id> [options]    Create a new draft
    --platform <platforms>                   Comma-separated: x,linkedin,threads,bluesky,mastodon
    --all                                    Post to all connected platforms
    --text <text>                            Post content (use --- on its own line for threads)
    --file, -f <path>                        Read content from file instead of --text
    --media <media_ids>                      Comma-separated media IDs
    --title <title>                          Draft title (internal only)
    --schedule <time>                        "now", "next-free-slot", or ISO datetime
    --tags <tag_slugs>                       Comma-separated tag slugs
    --reply-to <url>                         URL of X post to reply to
    --community <id>                         X community ID to post to
    --quote-post-url, --quote-url <url>      Quote an X post URL (X only)
    --paid-partnership                       Label X posts as paid partnership
    --made-with-ai                           Label X posts as made with AI
    --share                                  Generate a public share URL for the draft
    --notes, --scratchpad <text>             Internal notes/scratchpad for the draft

  drafts:update <social_set_id> <draft_id> [options]   Update a draft
    --platform <platforms>                   Comma-separated platforms
    --text <text>                            New post content
    --file, -f <path>                        Read content from file instead of --text
    --media <media_ids>                      Comma-separated media IDs
    --append, -a                             Append to existing thread instead of replacing
    --title <title>                          New draft title
    --schedule <time>                        "now", "next-free-slot", or ISO datetime
    --tags <tag_slugs>                       Comma-separated tag slugs
    --quote-post-url <url>                   Quote an X post URL (X only)
    --paid-partnership / --made-with-ai      X content disclosures
    --share                                  Generate a public share URL for the draft
    --notes, --scratchpad <text>             Internal notes
    --exclude-comment-markers                Strip <typ:comment-thread> markers in response
    --force-overwrite-comments               Destructive last resort; auto-resolves missing-anchor threads

  create-draft <text> [options]              Alias for drafts:create (positional text + --social-set-id)
  update-draft <draft_id> [text] [options]   Alias for drafts:update

  drafts:delete <social_set_id> <draft_id>   Delete a draft
  drafts:schedule <social_set_id> <draft_id> --time <time>     Schedule a draft
  drafts:publish <social_set_id> <draft_id>  Publish a draft immediately

  queue:get <social_set_id> --start-date <date> --end-date <date>
                                             Get queue slots and scheduled drafts
  queue:schedule:get <social_set_id>         Get queue schedule rules
  queue:schedule:put <social_set_id> --rules <json_array>
                                             Replace queue schedule rules

  comments:list <draft_id> --social-set-id <id> [options]
  comments:create <draft_id> --social-set-id <id> --post-index <n> --selected-text <t> --text <t>
  comments:reply <draft_id> <thread_id> --social-set-id <id> --text <t>
  comments:resolve <draft_id> <thread_id> --social-set-id <id>
  comments:update <draft_id> <thread_id> <comment_id> --social-set-id <id> --text <t>
  comments:delete <draft_id> <thread_id> [comment_id] --social-set-id <id>

  tags:list <social_set_id>                  List all tags
  tags:create <social_set_id> --name <name>  Create a new tag

  media:upload <social_set_id> <file>        Upload media file
    --no-wait                                Return immediately after upload (don't poll)
    --timeout <seconds>                      Max wait for processing (default: 60)
  media:status <social_set_id> <media_id>    Check media upload status
`);
}

// ============================================================================
// Main Router
// ============================================================================

const COMMANDS = {
  'me:get': cmdMeGet,
  'social-sets:list': cmdSocialSetsList,
  'social-sets:get': cmdSocialSetsGet,
  'linkedin:organizations:resolve': cmdLinkedInOrganizationsResolve,
  'analytics:posts:list': cmdAnalyticsPostsList,
  'analytics:followers:get': cmdAnalyticsFollowersGet,
  'drafts:list': cmdDraftsList,
  'drafts:get': cmdDraftsGet,
  'drafts:create': cmdDraftsCreate,
  'drafts:update': cmdDraftsUpdate,
  'create-draft': cmdCreateDraftAlias,
  'update-draft': cmdUpdateDraftAlias,
  'drafts:delete': cmdDraftsDelete,
  'drafts:schedule': cmdDraftsSchedule,
  'drafts:publish': cmdDraftsPublish,
  'queue:get': cmdQueueGet,
  'queue:schedule:get': cmdQueueScheduleGet,
  'queue:schedule:put': cmdQueueSchedulePut,
  'comments:list': cmdCommentsList,
  'comments:create': cmdCommentsCreate,
  'comments:reply': cmdCommentsReply,
  'comments:resolve': cmdCommentsResolve,
  'comments:update': cmdCommentsUpdate,
  'comments:delete': cmdCommentsDelete,
  'tags:list': cmdTagsList,
  'tags:create': cmdTagsCreate,
  'media:upload': cmdMediaUpload,
  'media:status': cmdMediaStatus,
  'help': showHelp,
  '--help': showHelp,
  '-h': showHelp,
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const commandArgs = args.slice(1);

  const handler = COMMANDS[command];

  if (!handler) {
    error(`Unknown command: ${command}`, { hint: 'Use --help for usage.' });
  }

  try {
    await handler(commandArgs);
  } catch (err) {
    if (err.code === 'ENOENT') {
      error(`File not found: ${err.path}`);
    }
    error(err.message, { stack: err.stack });
  }
}

main();
