import content from '../../content/portfolio.json' with { type: 'json' };

/**
 * @typedef {Object} SectionConfig
 * @property {string} id Stable hash anchor; independent of array position.
 * @property {string} title Korean navigation title.
 * @property {string} display Large English display title.
 * @property {'intro'|'interests'|'projects'|'experience'|'credentials'|'education'|'awards'|'publications'|'skills'|'activities'|'contact'} kind
 * @property {boolean} enabled
 * @property {string} [mergeInto] Parent chapter; records remain independently editable.
 * @property {string} [groupTitle] Navigation title when chapters are combined.
 * @property {string[]} [chapterOrder] Explicit child-tab order, independent of scroll order.
 * @property {string} sceneId References SceneAsset.id.
 * @property {string} headline
 * @property {string} body Replaceable draft, never a claimed credential.
 * @property {{side:'left'|'right'}} framing Text placement.
 * @property {ContentItem[]} items
 * @property {ContentItem[]} [showcaseItems] Separate display drafts; original items remain unchanged.
 * @property {string[]} [featuredItemIds] Shared gallery representatives, referencing child showcase item IDs.
 * @property {Array<{label:string,value:string}>} [facts]
 * @property {Array<{title:string,items:ContentItem[]}>} [groups]
 * @property {Array<{label:string,value:string,suffix?:string}>} [stats]
 * @property {string[]} [toolbox]
 *
 * @typedef {Object} ContentItem
 * @property {string} id Stable selection/detail key.
 * @property {string} title
 * @property {string} description
 * @property {string} [label] Short tab label.
 * @property {string} [displayName] Short localized name for the selected interest.
 * @property {string} [tag]
 * @property {string} [meta]
 * @property {string} [period]
 * @property {string} [image] Existing background-selection image path.
 * @property {{src:string,thumbnail?:string,alt:string,temporary:boolean,hero?:{position:string,scale:number},card?:{position:string,scale:number},backdrop?:{position:string,scale:number}}} [artwork] Replaceable illustration and optional crop settings.
 * @property {string} [approach] Authored interest exploration method.
 * @property {string} [question] Authored research question.
 * @property {string} [backgroundId] Optional BackgroundTrack; active only in this section.
 * @property {Array<{title:string,body:string}>} [detailSections] Authored reading sections.
 * @property {Array<{label:string,url:string}>} [links]
 * @property {string} [role]
 * @property {string} [result]
 * @property {string[]} [tags]
 * @property {string} [detail]
 * @property {string[]} [bullets]
 * @property {string} [why]
 * @property {string} [where]
 * @property {string} [summary]
 * @property {string} [accent]
 * @property {string} [badge]
 * @property {number|null} [level] Optional authored value, never inferred proficiency.
 * @property {boolean} [placeholder]
 *
 * @typedef {{order:string, visibleCount:number, width:number, height:number}} PointTier
 * @typedef {{texture:string, tiers:Record<string,PointTier>}} SceneEndpoint
 *
 * @typedef {Object} SceneAsset
 * @property {string} id
 * @property {string} video Packed color/depth video URL.
 * @property {number} startFrame Inclusive.
 * @property {number} endFrame Inclusive last valid frame.
 * @property {number} fps
 * @property {number[]} colorRect Normalized top-left texture rectangle.
 * @property {number[]} depthRect
 * @property {number} aspect
 * @property {'duotone'|'source'} [colorMode]
 * @property {string} still
 * @property {SceneEndpoint} entry
 * @property {SceneEndpoint} exit
 */

// Editable content is managed through the hosted Pages CMS.
// Pages CMS omits empty fields on save. Restore the arrays required by the UI.
export function normalizeContent(data) {
  return {
    profile: { name: '', role: '', tagline: '', affiliation: '', email: '', cv: '', links: [], ...data.profile },
    sections: (data.sections || []).map(section => ({
      ...section,
      display: section.display || '',
      items: section.items || [],
      ...(['projects', 'experience', 'publications', 'activities'].includes(section.kind) ? { showcaseItems: section.showcaseItems || [] } : {}),
      ...(section.groups ? { groups: section.groups.map(group => ({ ...group, items: group.items || [] })) } : {}),
    })),
  };
}
const normalized = normalizeContent(content);
/** @type {SectionConfig[]} */
export const sections = normalized.sections;
export const profile = normalized.profile;
/**
 * @typedef {Object} BackgroundTrack
 * @property {string} id
 * @property {string} video Public-relative video URL; frames follow page scroll.
 * @property {string} poster
 * @property {number[]} colorRect Normalized top-left rectangle.
 * @property {number[]} [depthRect] Legacy source metadata; ignored by the video renderer.
 * @property {number} aspect Color frame aspect ratio.
 * @property {number} [fps] Source frame rate; defaults to 30 for optional videos.
 */
/** @type {BackgroundTrack[]} Add optional item videos here and reference their ID. */
export const backgroundTracks = [];
export const assetUrl = (path) => /^https?:\/\//i.test(path) ? path : `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${path}`;
export function activeSections(items) {
  const enabled = items.filter(item => item.enabled);
  return enabled.filter(item => !enabled.some(parent => parent.id === item.mergeInto)).map(parent => {
    const children = enabled.filter(item => item.mergeInto === parent.id);
    if (parent.chapterOrder) children.sort((a,b) => {
      const rank = item => { const index = parent.chapterOrder.indexOf(item.id); return index < 0 ? parent.chapterOrder.length : index; };
      return rank(a) - rank(b);
    });
    return children.length ? {...parent, title:parent.groupTitle || parent.title, chapters:[parent,...children]} : parent;
  });
}

export const sectionForAnchor = (items, id) => items.find(section => section.id === id || section.chapters?.some(chapter => chapter.id === id));
