import { defineQuery } from "next-sanity";

/**
 * Every GROQ query used by the site, in one place. Each query returns only
 * the fields its view needs; results are converted to the app model by
 * src/lib/content/normalize.ts before reaching any component.
 *
 * After changing a query or the schema, re-run `npm run sanity:typegen` to
 * refresh the generated result types.
 */

export const SITE_SETTINGS_QUERY = defineQuery(`*[_type == "siteSettings"][0]{
  title,
  description,
  "logoUrl": logo.asset->url,
  contactUrl,
  linkedinUrl,
  navigation[]{ label, href, available },
  workStartYear,
  workEndYear,
  seoTitle,
  seoDescription,
  defaultOgImage,
  "faviconUrl": favicon.asset->url
}`);

export const WORK_INDEX_QUERY =
  defineQuery(`*[_type == "client" && hidden != true] | order(name asc){
  "id": _id,
  name,
  "slug": slug.current,
  "logoUrl": logo.asset->url,
  logoAspect,
  logoTreatment{
    scale,
    padding,
    alignment,
    "lightUrl": logoLight.asset->url,
    "darkUrl": logoDark.asset->url,
    "compactUrl": compactLogo.asset->url
  },
  description,
  engagements[]{ startYear, endYear, tags, description },
  caseStudy{
    "slug": slug.current,
    title,
    heroImage
  }
}`);

export const CASE_STUDY_QUERY =
  defineQuery(`*[_type == "client" && caseStudy.slug.current == $slug && hidden != true][0]{
  "clientId": _id,
  "clientName": name,
  "logoUrl": logo.asset->url,
  engagements[]{ startYear, endYear, tags },
  caseStudy{
    "slug": slug.current,
    title,
    subtitle,
    displayDate,
    shortDescription,
    body,
    externalUrl,
    heroImage{ ..., "dimensions": asset->metadata.dimensions, "lqip": asset->metadata.lqip },
    gallery[]{
      _key,
      mediaType,
      image{ ..., "dimensions": asset->metadata.dimensions, "lqip": asset->metadata.lqip },
      "videoFileUrl": video.asset->url,
      videoUrl,
      poster,
      alt,
      caption,
      aspect
    },
    seoTitle,
    seoDescription,
    ogImage
  }
}`);

export const CASE_STUDY_SLUGS_QUERY =
  defineQuery(`*[_type == "client" && defined(caseStudy.slug.current) && hidden != true]{
  "slug": caseStudy.slug.current,
  "updatedAt": _updatedAt
}`);
