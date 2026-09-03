/**
 * Placeholder content for the homepage and About page.
 *
 * These defaults serve three roles: the fixtures adapter returns them
 * directly, the Sanity adapter falls back to them field-by-field when the
 * documents don't exist yet, and the seed script copies them into Sanity so
 * everything is editable in the Studio immediately. Cover artwork is locally
 * generated (scripts/generate-covers.mjs) — original designs, no fetched
 * imagery.
 */

import type { AboutPageContent, HomePageContent } from "./model";

export const HOME_PAGE_DEFAULTS: HomePageContent = {
  intro:
    "Independent designer working on interfaces, interaction and product strategy across AI, hardware and consumer software.",
  seo: { title: null, description: null },
};

const movieCover = (slug: string) => `/placeholders/covers/movies/${slug}.svg`;
const bookCover = (slug: string) => `/placeholders/covers/books/${slug}.svg`;
const coverAlt = (title: string) => `Placeholder cover artwork for “${title}”`;

export const ABOUT_PAGE_DEFAULTS: AboutPageContent = {
  intro:
    "I'm a designer who likes building the thing, not just drawing it. For fifteen years I've worked where interface, hardware and brand overlap — usually beside small teams shipping the first version of something they care about.",
  facts: [
    { label: "Location", value: "Toronto, Canada" },
    { label: "Currently", value: "Independent designer" },
    { label: "Experience", value: "15+ years" },
  ],
  careerStatement:
    "My approach hasn't changed much since the beginning: understand the constraint before the canvas, prototype early enough to be wrong cheaply, and stay close to the people doing the engineering. The work in between — the naming, the edge cases, the unglamorous decisions — is the actual design.",
  experienceLabel: "Experience",
  experience: [
    { year: "2009", title: "Junior Designer", employer: "Fieldnote Studio" },
    { year: "2012", title: "Product Designer", employer: "Northlight Labs" },
    { year: "2015", title: "Senior Product Designer", employer: "Auralith" },
    { year: "2018", title: "Design Lead", employer: "Emberline" },
    { year: "2021", title: "Principal Designer", employer: "Independent" },
    { year: "2024", title: "Design Partner", employer: "Independent practice" },
  ],
  principlesLabel: "What I care about",
  principles: [
    {
      title: "Restraint over spectacle",
      body: "The best interface is the one that gets out of the way. Motion, colour and voice earn their place or they go.",
    },
    {
      title: "Prototypes over promises",
      body: "A rough thing you can touch settles more arguments than a beautiful deck ever will.",
    },
    {
      title: "Details are the design",
      body: "Empty states, error copy, focus rings, the second visit — the product lives in the parts nobody demos.",
    },
    {
      title: "Ship with the team",
      body: "Design that stops at handoff isn't finished. I stay through the build, because that's where it gets real.",
    },
  ],
  moviesLabel: "Favourite movies",
  booksLabel: "Favourite books",
  movies: [
    {
      title: "Back to the Future",
      year: 1985,
      coverUrl: movieCover("back-to-the-future"),
      alt: coverAlt("Back to the Future"),
    },
    {
      title: "Stand by Me",
      year: 1986,
      coverUrl: movieCover("stand-by-me"),
      alt: coverAlt("Stand by Me"),
    },
    {
      title: "Jurassic Park",
      year: 1993,
      coverUrl: movieCover("jurassic-park"),
      alt: coverAlt("Jurassic Park"),
    },
    {
      title: "The Matrix",
      year: 1999,
      coverUrl: movieCover("the-matrix"),
      alt: coverAlt("The Matrix"),
    },
    { title: "RoboCop", year: 1987, coverUrl: movieCover("robocop"), alt: coverAlt("RoboCop") },
    {
      title: "The Lord of the Rings",
      year: 2001,
      coverUrl: movieCover("the-lord-of-the-rings"),
      alt: coverAlt("The Lord of the Rings"),
    },
    {
      title: "Indiana Jones and the Raiders of the Lost Ark",
      year: 1981,
      coverUrl: movieCover("indiana-jones-and-the-raiders-of-the-lost-ark"),
      alt: coverAlt("Indiana Jones and the Raiders of the Lost Ark"),
    },
    { title: "Heat", year: 1995, coverUrl: movieCover("heat"), alt: coverAlt("Heat") },
    {
      title: "Fight Club",
      year: 1999,
      coverUrl: movieCover("fight-club"),
      alt: coverAlt("Fight Club"),
    },
    {
      title: "The Dark Knight",
      year: 2008,
      coverUrl: movieCover("the-dark-knight"),
      alt: coverAlt("The Dark Knight"),
    },
  ],
  books: [
    {
      title: "Pet Sematary",
      author: "Stephen King",
      coverUrl: bookCover("pet-sematary"),
      alt: coverAlt("Pet Sematary"),
    },
    {
      title: "Dungeon Crawler Carl",
      author: "Matt Dinniman",
      coverUrl: bookCover("dungeon-crawler-carl"),
      alt: coverAlt("Dungeon Crawler Carl"),
    },
    { title: "Dune", author: "Frank Herbert", coverUrl: bookCover("dune"), alt: coverAlt("Dune") },
    {
      title: "On Writing",
      author: "Stephen King",
      coverUrl: bookCover("on-writing"),
      alt: coverAlt("On Writing"),
    },
    {
      title: "Keith Haring Journals",
      author: "Keith Haring",
      coverUrl: bookCover("keith-haring-journals"),
      alt: coverAlt("Keith Haring Journals"),
    },
    {
      title: "The Lives of Brian",
      author: "Brian Johnson",
      coverUrl: bookCover("the-lives-of-brian"),
      alt: coverAlt("The Lives of Brian"),
    },
    {
      title: "I Am Ozzy",
      author: "Ozzy Osbourne",
      coverUrl: bookCover("i-am-ozzy"),
      alt: coverAlt("I Am Ozzy"),
    },
    {
      title: "Ready Player One",
      author: "Ernest Cline",
      coverUrl: bookCover("ready-player-one"),
      alt: coverAlt("Ready Player One"),
    },
    {
      title: "Neuromancer",
      author: "William Gibson",
      coverUrl: bookCover("neuromancer"),
      alt: coverAlt("Neuromancer"),
    },
    {
      title: "Kitchen Confidential",
      author: "Anthony Bourdain",
      coverUrl: bookCover("kitchen-confidential"),
      alt: coverAlt("Kitchen Confidential"),
    },
  ],
  contactHeading: "Working on something?",
  contactBody:
    "I take on a small number of engagements a year — usually early, usually hands-on. If that sounds like your project, I'd like to hear about it.",
  contactCtaLabel: "Get in touch",
  seo: {
    title: "About",
    description:
      "Designer working across interfaces, hardware and brand — background, experience and the things that shape the work.",
  },
};
