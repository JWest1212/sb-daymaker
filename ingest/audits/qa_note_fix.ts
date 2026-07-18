// ingest/audits/qa_note_fix.ts  (Gate 0 close: G0.1 approved copy fixes)
// Founder-approved replacement copy for the 11 leaked-QA-note rows. APPLY-gated.
// Run (plan):  node --env-file=.env.local --import tsx ingest/audits/qa_note_fix.ts
// Run (apply): APPLY=1 node --env-file=.env.local --import tsx ingest/audits/qa_note_fix.ts

import { getDb } from '../db';
import { isMain } from './_util';

const UPDATES: { id: string; title: string; fields: Record<string, string | null> }[] = [
  { id: "29d8129b-a514-56aa-8028-5ddac4d620da", title: "1st Thursday Art Walk", fields: {"local_note": "Start at the Santa Barbara Museum of Art and work outward. The downtownsb.org map lets you heart the galleries you want and build a route before you go, so you're not wandering State Street guessing which doors are open."} },
  { id: "07b8f214-cc7c-5cc7-b44f-edd9cada9467", title: "Live Music at Lama Dog", fields: {"reason_to_go": "A proper tap room and bottle shop in the heart of the Funk Zone: dozens of rotating drafts, cans and bottles to take home, and a regular rotation of trivia, bingo, and pint nights. Music turns up around the beer releases and art markets."} },
  { id: "2b0c22a8-fb9b-5045-be55-5724e1ed01fb", title: "Goleta Beach Half Marathon", fields: {"local_note": "An 8am half-marathon gun, then the 10K at 8:30 and the 5K at 9, all rolling out of Goleta Beach on the flat creekside bike path toward Santa Barbara. Sign up online ahead of time, there are no race-day entries. If you're spectating, the kids' mile at 9:45 stays inside the park, so you can plant yourself at the finish and catch every distance coming home."} },
  { id: "5fc68c7d-91ad-5014-893d-d7d2aab22116", title: "Funk Zone Art Walk", fields: {"local_note": null, "reason_to_go": "Wander the Funk Zone's studios and galleries on an evening art walk, with pop-up artists, live music, and wine throughout the Zone."} },
  { id: "65649aa8-f05a-572f-b3eb-33e1e7bba760", title: "Palihouse", fields: {"local_note": "The garden caf\u00e9 and bar in the courtyard is open to the public, not just hotel guests, so you can wander in off Garden Street for a coffee or a cocktail under the fountain and the pink umbrellas."} },
  { id: "a6296a75-daab-5cad-9fbe-f4e584aca4e1", title: "The Stow House", fields: {"local_note": "Parking is free and shared with the lake trails and the railroad museum, so come early, do the loop around Lake Los Carneros, then catch the 2pm house tour. Admission is a suggested $5."} },
  { id: "584cb094-2fb6-5ce3-8275-230c8f7157dc", title: "COLORS OF LOVE, Summer 2026", fields: {"blurb": "Transform Through Arts brings back Colors of Love, a one-night multicultural dance show with live musicians, tango to flamenco to belly dance, upstairs at Center Stage.", "blurb_long": "The 12th annual Colors of Love packs professional dancers and live musicians into one evening at Center Stage, moving through Argentine Tango, Samba, flamenco, belly dance, and Latin styles under the banner of unity and women's empowerment. Beth Amine emcees the single performance on Saturday, July 25 at 7:30pm. Advance tickets are $35, students $25 with ID, and kids K-12 come free with a paying adult. Seating is general admission, so arrive early for the good spots.", "local_note": "Center Stage is the intimate black box upstairs at Paseo Nuevo, seating about 150 with the stage close enough to feel the footwork."} },
  { id: "c589e83b-d520-5273-b776-c315a42888dd", title: "Los Altos Restaurant", fields: {"local_note": "The salsa bar is the move: seven or eight house salsas plus pickled bits and condiments, self-serve, so you build your own heat before the food even lands. Tortillas are pressed by hand. Happy hour runs the late afternoon into early evening with cheap margaritas, micheladas, and a taco combo, and it stays quieter than the Santa Barbara Mexican spots people default to."} },
  { id: "0f7839e5-407b-5591-8429-85c14bb876ef", title: "Draughtsmen Aleworks", fields: {"local_note": null} },
  { id: "e09431a0-ac20-509c-8af2-653e0735099c", title: "Validation Ale", fields: {"blurb": "A clever, family-friendly Funk Zone brewery.", "local_note": "Validation lets the crowd pick the beer. Whatever gets ordered most in each style stays on tap, and a challenger brew is always trying to knock it off, so the list you drank last month may not be there now. Ask what's currently validated."} },
];

const LAMA_DOG_ID = '07b8f214-cc7c-5cc7-b44f-edd9cada9467';   // delete its fake weekly-music schedule
const VALIDATION_ID = 'e09431a0-ac20-509c-8af2-653e0735099c'; // relabel its Thursday schedule

async function main() {
  const apply = process.env.APPLY === '1';
  const sb = getDb();
  console.log(`[qa_note_fix] ${apply ? 'APPLYING' : 'PLAN (dry run)'}\n`);
  for (const u of UPDATES) {
    const cols = Object.keys(u.fields).join(', ');
    console.log(`  ${u.title}: set ${cols}`);
    if (apply) {
      const { error } = await sb.from('things').update(u.fields).eq('id', u.id);
      if (error) throw new Error(`${u.title}: ${error.message}`);
    }
  }
  console.log('  Live Music at Lama Dog: DELETE recurring_schedules (no verifiable weekly music)');
  console.log('  Validation Ale: recurring_schedules.label -> "Live music most Thursday evenings"');
  if (apply) {
    const d = await sb.from('recurring_schedules').delete().eq('thing_id', LAMA_DOG_ID);
    if (d.error) throw new Error(`lama dog schedule delete: ${d.error.message}`);
    const v = await sb.from('recurring_schedules').update({ label: 'Live music most Thursday evenings' }).eq('thing_id', VALIDATION_ID);
    if (v.error) throw new Error(`validation label: ${v.error.message}`);
  }
  console.log(`\n[qa_note_fix] ${apply ? 'done.' : 'plan only, re-run with APPLY=1.'}`);
  process.exit(0);
}

if (isMain(import.meta.url)) { main().catch((e) => { console.error(e); process.exit(1); }); }
