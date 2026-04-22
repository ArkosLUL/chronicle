/*
 * Copyright (C) 2024+ Chronicle <https://github.com/Emyrk/chronicle>
 * Released under GNU AGPL v3 license
 *
 * Server-side combat log generator for Chronicle.
 * Produces per-instance log files in Chronicle's V2 pipe-delimited format.
 */

#ifndef MOD_CHRONICLE_LOGGER_H
#define MOD_CHRONICLE_LOGGER_H

#include "ObjectGuid.h"
#include <fstream>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <unordered_set>

class Aura;
class AuraApplication;
class Map;
class Player;
class Spell;
class SpellInfo;
class Unit;
enum AuraRemoveMode : uint8;

// ---------------------------------------------------------------------------
// EventFormatter — produces Chronicle V2 pipe-delimited log lines.
//
// V2 format: <unix_millis>|EVENT_TYPE|field1|field2|...
// GUIDs:     0x%016llX of ObjectGuid::GetRawValue()
//            (AC's bit layout already matches Chronicle's expectations)
// ---------------------------------------------------------------------------
class EventFormatter
{
public:
    static std::string Guid(ObjectGuid guid);

    // ts helpers — returns GameTime milliseconds since epoch.
    static uint64 Now();

    // Log events
    static std::string Header(uint64 ts, std::string const& realmName);
    static std::string ZoneInfo(uint64 ts, std::string const& zoneName, uint32 instanceId);
    static std::string CombatantInfo(uint64 ts, Player* player);

    // Combat events
    static std::string Swing(uint64 ts, Unit* attacker, Unit* victim, uint32 damage);
    static std::string SpellDmg(uint64 ts, Unit* target, Unit* attacker, SpellInfo const* spell, int32 damage);
    static std::string Heal(uint64 ts, Unit* target, Unit* healer, SpellInfo const* spell, uint32 amount);
    static std::string Death(uint64 ts, Unit* victim, Unit* killer);

    // Aura events
    static std::string AuraApply(uint64 ts, Unit* target, Aura* aura);
    static std::string AuraRemove(uint64 ts, Unit* target, AuraApplication* aurApp);

    // Spell cast
    static std::string SpellGo(uint64 ts, Unit* caster, SpellInfo const* info);
};

// ---------------------------------------------------------------------------
// CombatLogWriter — one per active instance.  Owns an std::ofstream.
// ---------------------------------------------------------------------------
class CombatLogWriter
{
public:
    CombatLogWriter(std::string const& dir, uint32 mapId, uint32 instanceId);
    ~CombatLogWriter();

    void WriteLine(std::string const& line);
    void Flush();
    void Close();
    bool IsOpen() const;
    std::string const& GetPath() const { return _path; }

private:
    std::ofstream _file;
    std::string   _path;
};

// ---------------------------------------------------------------------------
// InstanceTracker — singleton.  Maps instanceId → CombatLogWriter.
// ---------------------------------------------------------------------------
class InstanceTracker
{
public:
    static InstanceTracker& Instance();

    void LoadConfig();
    bool IsEnabled() const { return _enabled; }

    // Called from AllMapScript hooks
    void OnPlayerEnterInstance(Map* map, Player* player);
    void OnPlayerLeaveInstance(Map* map, Player* player);
    void RemoveInstance(uint32 instanceId);

    // Called from UnitScript / AllSpellScript hooks — resolves unit→map→writer.
    void WriteForUnit(Unit* unit, std::string const& line);

private:
    InstanceTracker() = default;

    CombatLogWriter* GetOrCreateWriter(Map* map);

    std::mutex _mutex;
    std::unordered_map<uint32, std::unique_ptr<CombatLogWriter>> _writers;
    // Set of (instanceId, playerGuid) pairs to avoid duplicate COMBATANT_INFO
    std::unordered_map<uint32, std::unordered_set<uint64>> _seenPlayers;

    bool        _enabled   = false;
    std::string _logDir    = "chronicle_logs";
    std::string _realmName = "AzerothCore";
};

#endif // MOD_CHRONICLE_LOGGER_H
