import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const ANISKIP_BASE = 'https://api.aniskip.com/v2';
const ANILIST_GRAPHQL = 'https://graphql.anilist.co';

/**
 * Resolve MyAnimeList (MAL) ID from anime object or AniList GraphQL
 * @param {object} anime 
 * @returns {Promise<number|null>}
 */
export async function resolveMalId(anime) {
  if (!anime) return null;

  // Direct MAL ID from OpenAnime or AnimeciX
  if (anime.mal_id && typeof anime.mal_id === 'number' && anime.mal_id > 0) {
    return anime.mal_id;
  }
  if (anime.malID && typeof anime.malID === 'number' && anime.malID > 0) {
    return anime.malID;
  }

  // Fallback: Query AniList GraphQL by anime name
  const title = anime.name_english || anime.name_romanji || anime.name;
  if (!title) return null;

  try {
    const query = `
      query ($q: String) {
        Media(search: $q, type: ANIME) {
          idMal
          title {
            romaji
            english
          }
        }
      }
    `;

    const res = await fetch(ANILIST_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AnyClient-Terminal/2.1'
      },
      body: JSON.stringify({
        query,
        variables: { q: title }
      })
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.Media?.idMal || null;
  } catch {
    return null;
  }
}

/**
 * Fetch opening, ending, and recap timestamps from AniSkip API
 * @param {number} malId 
 * @param {number} episode 
 * @returns {Promise<object>}
 */
export async function getAniSkipTimes(malId, episode = 1) {
  if (!malId || malId <= 0) {
    return { found: false, op: null, ed: null, recap: null };
  }

  const url = `${ANISKIP_BASE}/skip-times/${malId}/${episode}?types=op&types=ed&types=mixed-op&types=mixed-ed&types=recap&episodeLength=0`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AnyClient-Terminal/2.1'
      }
    });

    if (!res.ok) {
      return { found: false, op: null, ed: null, recap: null };
    }

    const data = await res.json();
    if (!data.found || !Array.isArray(data.results)) {
      return { found: false, op: null, ed: null, recap: null };
    }

    let op = null;
    let ed = null;
    let recap = null;

    for (const item of data.results) {
      const type = item.skipType;
      const interval = item.interval;
      if (!interval || typeof interval.startTime !== 'number' || typeof interval.endTime !== 'number') {
        continue;
      }

      const info = {
        start: Math.round(interval.startTime * 10) / 10,
        end: Math.round(interval.endTime * 10) / 10,
        duration: Math.round((interval.endTime - interval.startTime) * 10) / 10
      };

      if ((type === 'op' || type === 'mixed-op') && !op) {
        op = info;
      } else if ((type === 'ed' || type === 'mixed-ed') && !ed) {
        ed = info;
      } else if (type === 'recap' && !recap) {
        recap = info;
      }
    }

    return {
      found: Boolean(op || ed || recap),
      op,
      ed,
      recap
    };
  } catch (err) {
    return { found: false, op: null, ed: null, recap: null };
  }
}

/**
 * Generate temporary MPV Lua script for AniSkip auto/manual skipping
 * @param {object} options
 * @returns {string|null} Path to the generated Lua script
 */
export function createMpvAniSkipScript({ op, ed, recap, autoSkip = true, animeTitle = '', season = 1, episode = 1 }) {
  const scriptDir = path.join(os.homedir(), '.anyclient');
  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }
  const scriptPath = path.join(scriptDir, 'aniskip.lua');
  const actionPath = path.join(scriptDir, 'action.txt').replace(/\\/g, '/');

  const opStart = op ? op.start : -1;
  const opEnd = op ? op.end : -1;
  const edStart = ed ? ed.start : -1;
  const edEnd = ed ? ed.end : -1;
  const recapStart = recap ? recap.start : -1;
  const recapEnd = recap ? recap.end : -1;

  const safeTitle = (animeTitle || '').replace(/"/g, '\\"');
  const luaCode = `
-- AnyClient Minimalist Player Overlay & Skip Mod
local op_start = ${opStart}
local op_end = ${opEnd}
local ed_start = ${edStart}
local ed_end = ${edEnd}
local recap_start = ${recapStart}
local recap_end = ${recapEnd}
local auto_skip = ${autoSkip ? 'true' : 'false'}
local action_file = "${actionPath}"
local anime_title = "${safeTitle}"
local season_num = ${season}
local episode_num = ${episode}

local op_skipped = false
local ed_skipped = false
local recap_skipped = false

local overlay = mp.create_osd_overlay and mp.create_osd_overlay("ass-events") or nil

local function format_time(seconds)
    if not seconds or seconds < 0 then return "0:00" end
    local m = math.floor(seconds / 60)
    local s = math.floor(seconds % 60)
    return string.format("%d:%02d", m, s)
end

local function write_action(act)
    local f = io.open(action_file, "w")
    if f then
        f:write(act)
        f:close()
    end
end

-- Render subtle Netflix-style card in bottom-right corner
local function render_badge(badge_text, sub_text)
    if not overlay then return end
    if not badge_text or badge_text == "" then
        overlay.data = ""
        overlay:update()
        return
    end

    local ass = "{\\\\an3\\\\pos(1240,680)\\\\bord1.2\\\\3c&H444444&\\\\1c&H161618&\\\\1a&H25&\\\\p1}m 0 0 l 230 0 l 230 46 l 0 46{\\\\p0}"
    ass = ass .. "{\\\\an3\\\\pos(1225,666)\\\\fs17\\\\fnOutfit\\\\b1\\\\c&HFFFFFF&\\\\3c&H000000&\\\\bord0.8}" .. badge_text
    if sub_text and sub_text ~= "" then
        ass = ass .. "{\\\\fs12\\\\fnOutfit\\\\b0\\\\c&H9E9EA8&}  " .. sub_text
    end

    overlay.data = ass
    overlay.res_x = 1280
    overlay.res_y = 720
    overlay:update()
end

local function clear_badge()
    if overlay then
        overlay.data = ""
        overlay:update()
    end
end

-- Manual skip
local function manual_skip()
    local pos = mp.get_property_number("time-pos")
    if not pos then return end

    if op_start >= 0 and pos >= (op_start - 1.0) and pos < op_end then
        mp.set_property_number("time-pos", op_end)
        clear_badge()
        mp.osd_message("Açılış İntrosu Atlandı (" .. format_time(op_end) .. ")", 2.5)
    elseif ed_start >= 0 and pos >= (ed_start - 1.0) and pos < ed_end then
        mp.set_property_number("time-pos", ed_end)
        clear_badge()
        mp.osd_message("Kapanış (ED) Atlandı", 2.5)
    elseif recap_start >= 0 and pos >= (recap_start - 1.0) and pos < recap_end then
        mp.set_property_number("time-pos", recap_end)
        clear_badge()
        mp.osd_message("Özet (Recap) Atlandı", 2.5)
    else
        mp.osd_message("Şu an atlanabilir bir jenerik bulunmuyor", 2)
    end
end

mp.add_forced_key_binding("TAB", "aniskip_manual_skip", manual_skip)
mp.add_forced_key_binding("i", "aniskip_manual_skip_i", manual_skip)

-- Next Episode 'n'
mp.add_forced_key_binding("n", "anyclient_next_episode", function()
    write_action("next")
    clear_badge()
    mp.osd_message("Sıradaki Bölüm Yükleniyor... ⏭", 2)
    mp.command("quit")
end)

-- Previous Episode 'p'
mp.add_forced_key_binding("p", "anyclient_prev_episode", function()
    write_action("prev")
    clear_badge()
    mp.osd_message("Önceki Bölüme Dönülüyor... ⏮", 2)
    mp.command("quit")
end)

-- Quit cleanly with ESC or q
mp.add_forced_key_binding("ESC", "anyclient_quit_esc", function()
    clear_badge()
    mp.command("quit")
end)
mp.add_forced_key_binding("q", "anyclient_quit_q", function()
    clear_badge()
    mp.command("quit")
end)

-- Fullscreen toggle 'f'
mp.add_forced_key_binding("f", "anyclient_fs_toggle", function()
    local fs = mp.get_property_bool("fullscreen")
    mp.set_property_bool("fullscreen", not fs)
end)

-- Observe timeline for intro/outro and episode end
mp.observe_property("time-pos", "number", function(name, pos)
    if not pos then return end
    local duration = mp.get_property_number("duration") or 0

    -- 1. Opening Intro (OP)
    if op_start >= 0 and pos >= op_start and pos < op_end then
        if auto_skip and not op_skipped then
            mp.set_property_number("time-pos", op_end)
            clear_badge()
            mp.osd_message("Açılış İntrosu Atlandı", 2)
            op_skipped = true
            return
        elseif not auto_skip then
            render_badge("[ TAB ]  İntroyu Atla", format_time(op_end))
            return
        end
    end

    -- 2. Ending Outro (ED)
    if ed_start >= 0 and pos >= ed_start and pos < ed_end then
        if auto_skip and not ed_skipped then
            mp.set_property_number("time-pos", ed_end)
            clear_badge()
            mp.osd_message("Kapanış (ED) Atlandı", 2)
            ed_skipped = true
            return
        elseif not auto_skip then
            render_badge("[ TAB ]  Kapanışı Atla", "")
            return
        end
    end

    -- 3. Recap
    if recap_start >= 0 and pos >= recap_start and pos < recap_end then
        if auto_skip and not recap_skipped then
            mp.set_property_number("time-pos", recap_end)
            clear_badge()
            mp.osd_message("Özet Atlandı", 2)
            recap_skipped = true
            return
        elseif not auto_skip then
            render_badge("[ TAB ]  Özeti Atla", "")
            return
        end
    end

    -- 4. Next Episode suggestion in last 40 seconds
    if duration > 100 and (duration - pos) <= 40 and (duration - pos) >= 2 then
        render_badge("[ n ]  Sıradaki Bölüm", format_time(duration - pos))
        return
    end

    -- Clear badge if not in any special interval
    clear_badge()
end)

-- Natural EOF
mp.register_event("end-file", function(event)
    if event and event.reason == "eof" then
        write_action("ended")
    end
end)

-- Minimalist title badge on file loaded
mp.register_event("file-loaded", function()
    local opInfo = (op_start >= 0) and (" • OP: " .. format_time(op_start)) or ""
    local titleCard = anime_title ~= "" and (anime_title .. " • S" .. season_num .. "E" .. episode_num) or mp.get_property("media-title", "")
    mp.osd_message(titleCard .. opInfo, 3.5)
end)
`;

  fs.writeFileSync(scriptPath, luaCode, 'utf-8');
  return scriptPath;
}
