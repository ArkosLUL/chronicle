/*
 * Copyright (C) 2024+ Chronicle <https://github.com/Emyrk/chronicle>
 * Released under GNU AGPL v3 license
 */

#include "Chronicle.h"

#include "Config.h"
#include "GameTime.h"
#include "Guild.h"
#include "Item.h"
#include "Log.h"
#include "Map.h"
#include "Pet.h"
#include "Player.h"
#include "Spell.h"
#include "SpellInfo.h"
#include "SpellAuras.h"

#include <chrono>
#include <cstdio>
#include <ctime>
#include <filesystem>
#include <sstream>

// ===== EventFormatter =====

std::string EventFormatter::Guid(ObjectGuid guid)
{
    char buf[20];
    snprintf(buf, sizeof(buf), "0x%016llX",
             static_cast<unsigned long long>(guid.GetRawValue()));
    return buf;
}

uint64 EventFormatter::Now()
{
    // Real wall-clock milliseconds since Unix epoch.
    // GameTime::GetGameTimeMS() returns server uptime, not epoch time.
    auto now = std::chrono::system_clock::now();
    return static_cast<uint64>(
        std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch())
            .count());
}

// ---------------------------------------------------------------------------
// HEADER
// Format: ts|HEADER|0x0000000000000000|realmName||chronicle-server||||||||localTime|utcTime
// Chronicle's parser reads: playerGuid, realmName, zoneName, addonVersion,
//   superWoWVersion, namPowerVersion, xp3Version, wowVersion, wowBuild,
//   wowBuildDate, localTimeStr, utcTimeStr
// ---------------------------------------------------------------------------
std::string EventFormatter::Header(uint64 ts, std::string const& realmName)
{
    // Current UTC time formatted as Chronicle expects: "DD.MM.YY HH:MM:SS"
    auto now    = std::chrono::system_clock::now();
    auto tt     = std::chrono::system_clock::to_time_t(now);
    struct tm t = {};
    gmtime_r(&tt, &t);

    char timeBuf[32];
    snprintf(timeBuf, sizeof(timeBuf), "%02d.%02d.%02d %02d:%02d:%02d",
             t.tm_mday, t.tm_mon + 1, t.tm_year % 100,
             t.tm_hour, t.tm_min, t.tm_sec);

    std::ostringstream ss;
    ss << ts << "|HEADER"
       << "|0x0000000000000000"   // playerGuid (server-generated, no specific player)
       << "|" << realmName        // realmName
       << "|"                     // zoneName (filled in ZONE_INFO)
       << "|chronicle-server"     // addonVersion — identifies as server-generated
       << "|"                     // superWoWVersion
       << "|"                     // namPowerVersion
       << "|"                     // xp3Version
       << "|3.3.5a"              // wowVersion
       << "|12340"               // wowBuild (3.3.5a build number)
       << "|"                     // wowBuildDate
       << "|" << timeBuf          // localTime
       << "|" << timeBuf;         // utcTime (same, server is UTC)
    return ss.str();
}

// ---------------------------------------------------------------------------
// ZONE_INFO
// Format: ts|ZONE_INFO|zoneName|instanceId|inInstance|instanceType|isGhost
// ---------------------------------------------------------------------------
std::string EventFormatter::ZoneInfo(uint64 ts, std::string const& zoneName,
                                      uint32 instanceId, std::string const& instanceType)
{
    std::ostringstream ss;
    ss << ts << "|ZONE_INFO"
       << "|" << zoneName
       << "|" << instanceId
       << "|1"              // inInstance (always true — we only log instances)
       << "|" << instanceType
       << "|0";             // isGhost (not applicable server-side)
    return ss.str();
}

// ---------------------------------------------------------------------------
// COMBATANT_INFO
// Format: ts|COMBATANT_INFO|guid|name|CLASS|Race|gender|guildName|rankName|rank|gear|talents|petName|petGuid
// gear = &-separated slots: itemId:enchantId:suffixId:0 for 19 equipment slots
// ---------------------------------------------------------------------------

static std::string ClassToString(uint8 cls)
{
    switch (cls)
    {
        case 1:  return "WARRIOR";
        case 2:  return "PALADIN";
        case 3:  return "HUNTER";
        case 4:  return "ROGUE";
        case 5:  return "PRIEST";
        case 6:  return "DEATHKNIGHT";
        case 7:  return "SHAMAN";
        case 8:  return "MAGE";
        case 9:  return "WARLOCK";
        case 11: return "DRUID";
        default: return "UNKNOWN";
    }
}

static std::string RaceToString(uint8 race)
{
    switch (race)
    {
        case 1:  return "Human";
        case 2:  return "Orc";
        case 3:  return "Dwarf";
        case 4:  return "NightElf";
        case 5:  return "Scourge";
        case 6:  return "Tauren";
        case 7:  return "Gnome";
        case 8:  return "Troll";
        case 10: return "BloodElf";
        case 11: return "Draenei";
        default: return "Unknown";
    }
}

std::string EventFormatter::CombatantInfo(uint64 ts, Player* player)
{
    std::ostringstream ss;
    ss << ts << "|COMBATANT_INFO";

    // guid
    ss << "|" << Guid(player->GetGUID());
    // name
    ss << "|" << player->GetName();
    // class
    ss << "|" << ClassToString(player->getClass());
    // race
    ss << "|" << RaceToString(player->getRace());
    // gender
    ss << "|" << static_cast<int>(player->getGender());

    // guild info
    Guild* guild = player->GetGuild();
    if (guild)
    {
        ss << "|" << guild->GetName();
        uint8 rankId = player->GetRank();
        ss << "|Rank " << static_cast<int>(rankId); // rank name (no public API)
        ss << "|" << static_cast<int>(rankId);
    }
    else
    {
        ss << "||";   // empty guildName
        ss << "|";    // empty rankName
        ss << "|0";   // rank
    }

    // gear: 19 equipment slots, &-separated, each as itemId:enchantId:suffixId:0
    std::string gearStr;
    for (uint8 slot = 0; slot < 19; ++slot)  // EQUIPMENT_SLOT_START..EQUIPMENT_SLOT_END
    {
        if (slot > 0)
            gearStr += "&";

        Item* item = player->GetItemByPos(255 /*INVENTORY_SLOT_BAG_0*/, slot);
        if (item)
        {
            uint32 itemId    = item->GetEntry();
            uint32 enchantId = item->GetEnchantmentId(PERM_ENCHANTMENT_SLOT);
            int32  suffix    = item->GetItemRandomPropertyId();

            char itemBuf[64];
            snprintf(itemBuf, sizeof(itemBuf), "%u:%u:%d:0", itemId, enchantId, suffix);
            gearStr += itemBuf;
        }
        else
        {
            gearStr += "nil";
        }
    }
    ss << "|" << gearStr;

    // talents (empty for Phase 1)
    ss << "|nil";

    // pet name and guid
    Pet* pet = player->GetPet();
    if (pet)
    {
        ss << "|" << pet->GetName();
        ss << "|" << Guid(pet->GetGUID());
    }
    else
    {
        ss << "|nil";
        ss << "|nil";
    }

    return ss.str();
}

// ---------------------------------------------------------------------------
// SWING (melee auto-attack)
// Format: ts|SWING|attackerGuid|targetGuid|damage|hitInfo|victimState|1|0|0|0
// ---------------------------------------------------------------------------
std::string EventFormatter::Swing(uint64 ts, Unit* attacker, Unit* victim, uint32 damage)
{
    std::ostringstream ss;
    ss << ts << "|SWING"
       << "|" << Guid(attacker ? attacker->GetGUID() : ObjectGuid::Empty)
       << "|" << Guid(victim->GetGUID())
       << "|" << damage
       << "|2|1|1|0|0|0";  // hitInfo=normal, victimState=hit, 1 component, no block/absorb/resist
    return ss.str();
}

// ---------------------------------------------------------------------------
// SPELL_DMG
// Format: ts|SPELL_DMG|targetGuid|casterGuid|spellId|damage|0,0,0|hitInfo|school|0,0,0,0
// ---------------------------------------------------------------------------
std::string EventFormatter::SpellDmg(uint64 ts, Unit* target, Unit* attacker,
                                      SpellInfo const* spell, int32 damage)
{
    std::ostringstream ss;
    ss << ts << "|SPELL_DMG"
       << "|" << Guid(target->GetGUID())
       << "|" << Guid(attacker ? attacker->GetGUID() : ObjectGuid::Empty)
       << "|" << spell->Id
       << "|" << (damage > 0 ? damage : 0)
       << "|0,0,0"   // blocked, absorbed, resisted (Phase 1: not tracked)
       << "|1"        // hitInfo (1 = normal hit)
       << "|" << spell->SchoolMask
       << "|0,0,0,0"; // effects (Phase 1: not tracked)
    return ss.str();
}

// ---------------------------------------------------------------------------
// HEAL
// Format: ts|HEAL|targetGuid|casterGuid|spellId|amount|isCrit|isPeriodic
// ---------------------------------------------------------------------------
std::string EventFormatter::Heal(uint64 ts, Unit* target, Unit* healer,
                                  SpellInfo const* spell, uint32 amount)
{
    std::ostringstream ss;
    ss << ts << "|HEAL"
       << "|" << Guid(target->GetGUID())
       << "|" << Guid(healer ? healer->GetGUID() : ObjectGuid::Empty)
       << "|" << spell->Id
       << "|" << amount
       << "|0"   // isCrit (Phase 1: not tracked in this hook)
       << "|0";  // isPeriodic
    return ss.str();
}

// ---------------------------------------------------------------------------
// DEATH
// Format: ts|DEATH|victimGuid|killerGuid
// ---------------------------------------------------------------------------
std::string EventFormatter::Death(uint64 ts, Unit* victim, Unit* killer)
{
    std::ostringstream ss;
    ss << ts << "|DEATH"
       << "|" << Guid(victim->GetGUID())
       << "|" << Guid(killer ? killer->GetGUID() : ObjectGuid::Empty);
    return ss.str();
}

// ---------------------------------------------------------------------------
// BUFF_ADD / DEBUFF_ADD
// Format: ts|BUFF_ADD|targetGuid|luaSlot|spellId|stacks|auraLevel|auraSlot|state
// luaSlot, auraLevel, auraSlot are addon-specific — 0 from server.
// state: 0=added, 1=removed, 2=derive from event name
// ---------------------------------------------------------------------------
std::string EventFormatter::AuraApply(uint64 ts, Unit* target, Aura* aura)
{
    SpellInfo const* spell = aura->GetSpellInfo();
    bool isBuff = spell->IsPositive();

    std::ostringstream ss;
    ss << ts << "|" << (isBuff ? "BUFF_ADD" : "DEBUFF_ADD")
       << "|" << Guid(target->GetGUID())
       << "|0"                                          // luaSlot (N/A server-side)
       << "|" << spell->Id
       << "|" << static_cast<int>(aura->GetStackAmount())
       << "|0"                                          // auraLevel
       << "|0"                                          // auraSlot
       << "|0";                                         // state = added
    return ss.str();
}

// ---------------------------------------------------------------------------
// BUFF_REM / DEBUFF_REM
// Format: ts|BUFF_REM|targetGuid|luaSlot|spellId|stacks|auraLevel|auraSlot|state
// ---------------------------------------------------------------------------
std::string EventFormatter::AuraRemove(uint64 ts, Unit* target, AuraApplication* aurApp)
{
    Aura* aura = aurApp->GetBase();
    SpellInfo const* spell = aura->GetSpellInfo();
    bool isBuff = spell->IsPositive();

    std::ostringstream ss;
    ss << ts << "|" << (isBuff ? "BUFF_REM" : "DEBUFF_REM")
       << "|" << Guid(target->GetGUID())
       << "|0"                                          // luaSlot
       << "|" << spell->Id
       << "|" << static_cast<int>(aura->GetStackAmount())
       << "|0"                                          // auraLevel
       << "|0"                                          // auraSlot
       << "|1";                                         // state = removed
    return ss.str();
}

// ---------------------------------------------------------------------------
// SPELL_GO (spell cast completed)
// Format: ts|SPELL_GO|0|spellId|casterGuid|0x0000000000000000|0|0|0
// ---------------------------------------------------------------------------
std::string EventFormatter::SpellGo(uint64 ts, Unit* caster, SpellInfo const* info)
{
    std::ostringstream ss;
    ss << ts << "|SPELL_GO"
       << "|0"  // itemId (0 = not item-triggered)
       << "|" << info->Id
       << "|" << Guid(caster->GetGUID())
       << "|0x0000000000000000"  // target (not available in this hook)
       << "|0|0|0";             // castFlags, targetsHit, targetsMissed
    return ss.str();
}

// ---------------------------------------------------------------------------
// UNIT_INFO — registers a unit (player or NPC) with Chronicle's unit database.
// Format: ts|UNIT_INFO|guid|isPlayer|name|canCooperate|ownerGuid|buffs|level|challenges|maxHealth
// ---------------------------------------------------------------------------
std::string EventFormatter::UnitInfo(uint64 ts, Unit* unit)
{
    std::ostringstream ss;
    ss << ts << "|UNIT_INFO"
       << "|" << Guid(unit->GetGUID())
       << "|" << (unit->IsPlayer() ? "1" : "0")
       << "|" << unit->GetName()
       << "|" << (unit->IsPlayer() ? "1" : "0");  // canCooperate: players=friendly, NPCs=hostile

    // Owner (for pets/totems/guardians)
    ObjectGuid ownerGuid = unit->GetOwnerGUID();
    ss << "|";
    if (!ownerGuid.IsEmpty())
        ss << Guid(ownerGuid);

    // Buffs — comma-separated spellId=stacks for positive auras
    ss << "|";
    {
        bool first = true;
        Unit::AuraApplicationMap const& auras = unit->GetAppliedAuras();
        for (auto const& pair : auras)
        {
            AuraApplication* aurApp = pair.second;
            if (!aurApp)
                continue;
            Aura* aura = aurApp->GetBase();
            if (!aura || !aura->GetSpellInfo()->IsPositive())
                continue;
            if (!first)
                ss << ",";
            ss << aura->GetId() << "=" << static_cast<int>(aura->GetStackAmount());
            first = false;
        }
    }

    // Level
    ss << "|" << static_cast<int>(unit->GetLevel());
    // Challenges (not applicable server-side)
    ss << "|";
    // MaxHealth
    ss << "|" << unit->GetMaxHealth();

    return ss.str();
}

// ===== CombatLogWriter =====

CombatLogWriter::CombatLogWriter(std::string const& dir, uint32 mapId, uint32 instanceId)
{
    // Create directory if it doesn't exist
    std::filesystem::create_directories(dir);

    // Build filename: instance_<mapId>_<instanceId>_<timestamp>.log
    auto now = std::chrono::system_clock::now();
    auto epoch = std::chrono::duration_cast<std::chrono::seconds>(
                     now.time_since_epoch())
                     .count();

    char filename[128];
    snprintf(filename, sizeof(filename), "instance_%u_%u_%lld.log",
             mapId, instanceId, static_cast<long long>(epoch));

    _path = dir + "/" + filename;
    _file.open(_path, std::ios::out | std::ios::app);

    if (_file.is_open())
    {
        LOG_INFO("module", "Chronicle: opened log file {}", _path);
    }
    else
    {
        LOG_ERROR("module", "Chronicle: FAILED to open log file {}", _path);
    }
}

CombatLogWriter::~CombatLogWriter()
{
    Close();
}

void CombatLogWriter::WriteLine(std::string const& line)
{
    if (_file.is_open())
        _file << line << std::endl;  // endl flushes after every line
}

void CombatLogWriter::Flush()
{
    if (_file.is_open())
        _file.flush();
}

void CombatLogWriter::Close()
{
    if (_file.is_open())
    {
        _file.flush();
        _file.close();
        LOG_INFO("module", "Chronicle: closed log file {}", _path);
    }
}

bool CombatLogWriter::IsOpen() const
{
    return _file.is_open();
}

// ===== InstanceTracker =====

InstanceTracker& InstanceTracker::Instance()
{
    static InstanceTracker instance;
    return instance;
}

void InstanceTracker::LoadConfig()
{
    _enabled   = sConfigMgr->GetOption<bool>("Chronicle.Enable", true);
    _logDir    = sConfigMgr->GetOption<std::string>("Chronicle.LogDir", "chronicle_logs");
    _realmName = sConfigMgr->GetOption<std::string>("Chronicle.RealmName", "AzerothCore");

    LOG_INFO("module", "Chronicle: enabled={}, logDir={}, realm={}",
             _enabled, _logDir, _realmName);
}

CombatLogWriter* InstanceTracker::GetOrCreateWriter(Map* map)
{
    if (!map || !map->IsDungeon())
        return nullptr;

    uint32 instanceId = map->GetInstanceId();
    auto it = _writers.find(instanceId);
    if (it != _writers.end())
        return it->second.get();

    // Determine full log directory path.
    // AC sets LogsDir from env var AC_LOGS_DIR (typically /azerothcore/env/dist/logs).
    std::string logsDir = sConfigMgr->GetOption<std::string>("LogsDir", "");
    std::string logPath;
    if (logsDir.empty())
        logPath = _logDir;
    else
        logPath = logsDir + "/" + _logDir;

    auto writer = std::make_unique<CombatLogWriter>(logPath, map->GetId(), instanceId);
    if (!writer->IsOpen())
        return nullptr;

    // Write HEADER
    uint64 ts = EventFormatter::Now();
    writer->WriteLine(EventFormatter::Header(ts, _realmName));

    // Write ZONE_INFO
    std::string instanceType = map->IsRaid() ? "raid" : "party";
    writer->WriteLine(EventFormatter::ZoneInfo(ts, map->GetMapName(), instanceId, instanceType));

    CombatLogWriter* ptr = writer.get();
    _writers[instanceId] = std::move(writer);
    return ptr;
}

void InstanceTracker::OnPlayerEnterInstance(Map* map, Player* player)
{
    if (!_enabled || !map || !map->IsDungeon())
        return;

    std::lock_guard<std::mutex> lock(_mutex);

    CombatLogWriter* writer = GetOrCreateWriter(map);
    if (!writer)
        return;

    uint32 instanceId = map->GetInstanceId();
    uint64 playerGuid = player->GetGUID().GetRawValue();

    // Only write COMBATANT_INFO once per player per instance
    auto& seen = _seenPlayers[instanceId];
    if (seen.count(playerGuid))
        return;

    seen.insert(playerGuid);

    uint64 ts = EventFormatter::Now();
    writer->WriteLine(EventFormatter::CombatantInfo(ts, player));
    writer->Flush();
}

void InstanceTracker::OnPlayerLeaveInstance(Map* map, Player* /*player*/)
{
    if (!_enabled || !map || !map->IsDungeon())
        return;

    // We don't close the writer when a player leaves — the instance may still
    // be active with other players.  The writer is cleaned up when the instance
    // is destroyed (OnDestroyInstance).
}

void InstanceTracker::RemoveInstance(uint32 instanceId)
{
    std::lock_guard<std::mutex> lock(_mutex);

    auto it = _writers.find(instanceId);
    if (it != _writers.end())
    {
        it->second->Close();
        _writers.erase(it);
    }
    _seenPlayers.erase(instanceId);
    _seenUnits.erase(instanceId);
}

void InstanceTracker::EnsureUnitInfo(Unit* unit)
{
    if (!_enabled || !unit)
        return;

    Map* map = unit->FindMap();
    if (!map || !map->IsDungeon())
        return;

    std::lock_guard<std::mutex> lock(_mutex);

    uint32 instId = map->GetInstanceId();
    uint64 raw = unit->GetGUID().GetRawValue();

    auto& seen = _seenUnits[instId];
    if (seen.count(raw))
        return;
    seen.insert(raw);

    auto it = _writers.find(instId);
    if (it == _writers.end())
        return;

    it->second->WriteLine(EventFormatter::UnitInfo(EventFormatter::Now(), unit));
}

void InstanceTracker::WriteForUnit(Unit* unit, std::string const& line)
{
    if (!_enabled || !unit)
        return;

    Map* map = unit->FindMap();
    if (!map || !map->IsDungeon())
        return;

    std::lock_guard<std::mutex> lock(_mutex);

    uint32 instanceId = map->GetInstanceId();
    auto it = _writers.find(instanceId);
    if (it == _writers.end())
        return;  // No writer for this instance (shouldn't happen normally)

    it->second->WriteLine(line);
}
