import Pokemon, { HitResult, PlayerPokemon, PokemonMove } from "../field/pokemon";
import { Type } from "./type";
import { Constructor } from "#app/utils";
import * as Utils from "../utils";
import { BattleStat, getBattleStatName } from "./battle-stat";
import { MovePhase, PokemonHealPhase, ShowAbilityPhase, StatChangePhase } from "../phases";
import { getPokemonNameWithAffix } from "../messages";
import { Weather, WeatherType } from "./weather";
import { BattlerTag, GroundedTag } from "./battler-tags";
import { StatusEffect, getNonVolatileStatusEffects, getStatusEffectDescriptor, getStatusEffectHealText } from "./status-effect";
import { Gender } from "./gender";
import Move, { AttackMove, MoveCategory, MoveFlags, MoveTarget, FlinchAttr, OneHitKOAttr, HitHealAttr, allMoves, StatusMove, SelfStatusMove, VariablePowerAttr, applyMoveAttrs, IncrementMovePriorityAttr, VariableMoveTypeAttr, RandomMovesetMoveAttr, RandomMoveAttr, NaturePowerAttr, CopyMoveAttr, MoveAttr, MultiHitAttr, ChargeAttr, SacrificialAttr, SacrificialAttrOnHit } from "./move";
import { ArenaTagSide, ArenaTrapTag } from "./arena-tag";
import { Stat, getStatName } from "./pokemon-stat";
import { BerryModifier, PokemonHeldItemModifier } from "../modifier/modifier";
import { TerrainType } from "./terrain";
import { SpeciesFormChangeManualTrigger } from "./pokemon-forms";
import i18next from "i18next";
import { Localizable } from "#app/interfaces/locales.js";
import { Command } from "../ui/command-ui-handler";
import { BerryModifierType } from "#app/modifier/modifier-type";
import { getPokeballName } from "./pokeball";
import { BattlerIndex } from "#app/battle";
import { Abilities } from "#enums/abilities";
import { ArenaTagType } from "#enums/arena-tag-type";
import { BattlerTagType } from "#enums/battler-tag-type";
import { Moves } from "#enums/moves";
import { Species } from "#enums/species";

export class Ability implements Localizable {
  public id: Abilities;

  private nameAppend: string;
  public name: string;
  public description: string;
  public generation: integer;
  public isBypassFaint: boolean;
  public isIgnorable: boolean;
  public attrs: AbAttr[];
  public conditions: AbAttrCondition[];

  constructor(id: Abilities, generation: integer) {
    this.id = id;

    this.nameAppend = "";
    this.generation = generation;
    this.attrs = [];
    this.conditions = [];

    this.localize();
  }

  localize(): void {
    const i18nKey = Abilities[this.id].split("_").filter(f => f).map((f, i) => i ? `${f[0]}${f.slice(1).toLowerCase()}` : f.toLowerCase()).join("") as string;

    this.name = this.id ? `${i18next.t(`ability:${i18nKey}.name`) as string}${this.nameAppend}` : "";
    this.description = this.id ? i18next.t(`ability:${i18nKey}.description`) as string : "";
  }

  /**
   * Get all ability attributes that match `attrType`
   * @param attrType any attribute that extends {@linkcode AbAttr}
   * @returns Array of attributes that match `attrType`, Empty Array if none match.
   */
  getAttrs<T extends AbAttr>(attrType: Constructor<T> ): T[] {
    return this.attrs.filter((a): a is T => a instanceof attrType);
  }

  /**
   * Check if an ability has an attribute that matches `attrType`
   * @param attrType any attribute that extends {@linkcode AbAttr}
   * @returns true if the ability has attribute `attrType`
   */
  hasAttr<T extends AbAttr>(attrType: Constructor<T>): boolean {
    return this.attrs.some((attr) => attr instanceof attrType);
  }

  attr<T extends Constructor<AbAttr>>(AttrType: T, ...args: ConstructorParameters<T>): Ability {
    const attr = new AttrType(...args);
    this.attrs.push(attr);

    return this;
  }

  conditionalAttr<T extends Constructor<AbAttr>>(condition: AbAttrCondition, AttrType: T, ...args: ConstructorParameters<T>): Ability {
    const attr = new AttrType(...args);
    attr.addCondition(condition);
    this.attrs.push(attr);

    return this;
  }

  bypassFaint(): Ability {
    this.isBypassFaint = true;
    return this;
  }

  ignorable(): Ability {
    this.isIgnorable = true;
    return this;
  }

  condition(condition: AbAttrCondition): Ability {
    this.conditions.push(condition);

    return this;
  }

  partial(): this {
    this.nameAppend += " (P)";
    return this;
  }

  unimplemented(): this {
    this.nameAppend += " (N)";
    return this;
  }
}

type AbAttrApplyFunc<TAttr extends AbAttr> = (attr: TAttr, passive: boolean) => boolean | Promise<boolean>;
type AbAttrCondition = (pokemon: Pokemon) => boolean;

type PokemonAttackCondition = (user: Pokemon, target: Pokemon, move: Move) => boolean;
type PokemonDefendCondition = (target: Pokemon, user: Pokemon, move: Move) => boolean;
type PokemonStatChangeCondition = (target: Pokemon, statsChanged: BattleStat[], levels: integer) => boolean;

export abstract class AbAttr {
  public showAbility: boolean;
  private extraCondition: AbAttrCondition;

  constructor(showAbility: boolean = true) {
    this.showAbility = showAbility;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean | Promise<boolean> {
    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return null;
  }

  getCondition(): AbAttrCondition | null {
    return this.extraCondition || null;
  }

  addCondition(condition: AbAttrCondition): AbAttr {
    this.extraCondition = condition;
    return this;
  }
}

export class BlockRecoilDamageAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    cancelled.value = true;

    return true;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]) {
    return i18next.t("abilityTriggers:blockRecoilDamage", {pokemonName: getPokemonNameWithAffix(pokemon), abilityName: abilityName});
  }
}

export class DoubleBattleChanceAbAttr extends AbAttr {
  constructor() {
    super(false);
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const doubleChance = (args[0] as Utils.IntegerHolder);
    doubleChance.value = Math.max(doubleChance.value / 2, 1);
    return true;
  }
}

export class PostBattleInitAbAttr extends AbAttr {
  applyPostBattleInit(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

export class PostBattleInitFormChangeAbAttr extends PostBattleInitAbAttr {
  private formFunc: (p: Pokemon) => integer;

  constructor(formFunc: ((p: Pokemon) => integer)) {
    super(true);

    this.formFunc = formFunc;
  }

  applyPostBattleInit(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const formIndex = this.formFunc(pokemon);
    if (formIndex !== pokemon.formIndex) {
      return pokemon.scene.triggerPokemonFormChange(pokemon, SpeciesFormChangeManualTrigger, false);
    }

    return false;
  }
}

export class PostBattleInitStatChangeAbAttr extends PostBattleInitAbAttr {
  private stats: BattleStat[];
  private levels: integer;
  private selfTarget: boolean;

  constructor(stats: BattleStat | BattleStat[], levels: integer, selfTarget?: boolean) {
    super();

    this.stats = typeof(stats) === "number"
      ? [ stats as BattleStat ]
      : stats as BattleStat[];
    this.levels = levels;
    this.selfTarget = !!selfTarget;
  }

  applyPostBattleInit(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const statChangePhases: StatChangePhase[] = [];

    if (this.selfTarget) {
      statChangePhases.push(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, this.stats, this.levels));
    } else {
      for (const opponent of pokemon.getOpponents()) {
        statChangePhases.push(new StatChangePhase(pokemon.scene, opponent.getBattlerIndex(), false, this.stats, this.levels));
      }
    }

    for (const statChangePhase of statChangePhases) {
      if (!this.selfTarget && !statChangePhase.getPokemon().summonData) {
        pokemon.scene.pushPhase(statChangePhase);
      } else { // TODO: This causes the ability bar to be shown at the wrong time
        pokemon.scene.unshiftPhase(statChangePhase);
      }
    }

    return true;
  }
}

type PreDefendAbAttrCondition = (pokemon: Pokemon, attacker: Pokemon, move: Move) => boolean;

export class PreDefendAbAttr extends AbAttr {
  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

export class PreDefendFormChangeAbAttr extends PreDefendAbAttr {
  private formFunc: (p: Pokemon) => integer;

  constructor(formFunc: ((p: Pokemon) => integer)) {
    super(true);

    this.formFunc = formFunc;
  }

  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const formIndex = this.formFunc(pokemon);
    if (formIndex !== pokemon.formIndex) {
      pokemon.scene.triggerPokemonFormChange(pokemon, SpeciesFormChangeManualTrigger, false);
      return true;
    }

    return false;
  }
}
export class PreDefendFullHpEndureAbAttr extends PreDefendAbAttr {
  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (pokemon.isFullHp() &&
        pokemon.getMaxHp() > 1 && //Checks if pokemon has wonder_guard (which forces 1hp)
        (args[0] as Utils.NumberHolder).value >= pokemon.hp) { //Damage >= hp
      return pokemon.addTag(BattlerTagType.STURDY, 1);
    }

    return false;
  }
}

export class BlockItemTheftAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    cancelled.value = true;

    return true;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]) {
    return i18next.t("abilityTriggers:blockItemTheft", {
      pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
      abilityName
    });
  }
}

export class StabBoostAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if ((args[0] as Utils.NumberHolder).value > 1) {
      (args[0] as Utils.NumberHolder).value += 0.5;
      return true;
    }

    return false;
  }
}

export class ReceivedMoveDamageMultiplierAbAttr extends PreDefendAbAttr {
  protected condition: PokemonDefendCondition;
  private damageMultiplier: number;

  constructor(condition: PokemonDefendCondition, damageMultiplier: number) {
    super();

    this.condition = condition;
    this.damageMultiplier = damageMultiplier;
  }

  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.condition(pokemon, attacker, move)) {
      (args[0] as Utils.NumberHolder).value = Math.floor((args[0] as Utils.NumberHolder).value * this.damageMultiplier);

      return true;
    }

    return false;
  }
}

export class ReceivedTypeDamageMultiplierAbAttr extends ReceivedMoveDamageMultiplierAbAttr {
  constructor(moveType: Type, damageMultiplier: number) {
    super((user, target, move) => move.type === moveType, damageMultiplier);
  }
}

export class PreDefendMoveDamageToOneAbAttr extends ReceivedMoveDamageMultiplierAbAttr {
  constructor(condition: PokemonDefendCondition) {
    super(condition, 1);
  }

  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.condition(pokemon, attacker, move)) {
      (args[0] as Utils.NumberHolder).value = Math.floor(pokemon.getMaxHp() / 8);
      return true;
    }

    return false;
  }
}

/**
 * Determines whether a Pokemon is immune to a move because of an ability.
 * @extends PreDefendAbAttr
 * @see {@linkcode applyPreDefend}
 * @see {@linkcode getCondition}
 */
export class TypeImmunityAbAttr extends PreDefendAbAttr {
  private immuneType: Type;
  private condition: AbAttrCondition;

  constructor(immuneType: Type, condition?: AbAttrCondition) {
    super();

    this.immuneType = immuneType;
    this.condition = condition;
  }

  /**
   * Applies immunity if this ability grants immunity to the type of the given move.
   * @param pokemon {@linkcode Pokemon} The defending Pokemon.
   * @param passive - Whether the ability is passive.
   * @param attacker {@linkcode Pokemon} The attacking Pokemon.
   * @param move {@linkcode Move} The attacking move.
   * @param cancelled {@linkcode Utils.BooleanHolder} - A holder for a boolean value indicating if the move was cancelled.
   * @param args [0] {@linkcode Utils.NumberHolder} gets set to 0 if move is immuned by an ability.
   * @param args [1] - Whether the move is simulated.
   */
  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    // Field moves should ignore immunity
    if ([ MoveTarget.BOTH_SIDES, MoveTarget.ENEMY_SIDE, MoveTarget.USER_SIDE ].includes(move.moveTarget)) {
      return false;
    }

    if (attacker !== pokemon && move.type === this.immuneType) {
      (args[0] as Utils.NumberHolder).value = 0;
      return true;
    }

    return false;
  }

  getCondition(): AbAttrCondition {
    return this.condition;
  }
}

export class TypeImmunityHealAbAttr extends TypeImmunityAbAttr {
  constructor(immuneType: Type) {
    super(immuneType);
  }

  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const ret = super.applyPreDefend(pokemon, passive, attacker, move, cancelled, args);

    if (ret) {
      if (!pokemon.isFullHp()) {
        const simulated = args.length > 1 && args[1];
        if (!simulated) {
          const abilityName = (!passive ? pokemon.getAbility() : pokemon.getPassiveAbility()).name;
          pokemon.scene.unshiftPhase(new PokemonHealPhase(pokemon.scene, pokemon.getBattlerIndex(),
            Math.max(Math.floor(pokemon.getMaxHp() / 4), 1), i18next.t("abilityTriggers:typeImmunityHeal", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), abilityName }), true));
        }
      }
      return true;
    }

    return false;
  }
}

class TypeImmunityStatChangeAbAttr extends TypeImmunityAbAttr {
  private stat: BattleStat;
  private levels: integer;

  constructor(immuneType: Type, stat: BattleStat, levels: integer, condition?: AbAttrCondition) {
    super(immuneType, condition);

    this.stat = stat;
    this.levels = levels;
  }

  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const ret = super.applyPreDefend(pokemon, passive, attacker, move, cancelled, args);

    if (ret) {
      cancelled.value = true;
      const simulated = args.length > 1 && args[1];
      if (!simulated) {
        pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, [ this.stat ], this.levels));
      }
    }

    return ret;
  }
}

class TypeImmunityAddBattlerTagAbAttr extends TypeImmunityAbAttr {
  private tagType: BattlerTagType;
  private turnCount: integer;

  constructor(immuneType: Type, tagType: BattlerTagType, turnCount: integer, condition?: AbAttrCondition) {
    super(immuneType, condition);

    this.tagType = tagType;
    this.turnCount = turnCount;
  }

  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const ret = super.applyPreDefend(pokemon, passive, attacker, move, cancelled, args);

    if (ret) {
      cancelled.value = true;
      const simulated = args.length > 1 && args[1];
      if (!simulated) {
        pokemon.addTag(this.tagType, this.turnCount, undefined, pokemon.id);
      }
    }

    return ret;
  }
}

export class NonSuperEffectiveImmunityAbAttr extends TypeImmunityAbAttr {
  constructor(condition?: AbAttrCondition) {
    super(null, condition);
  }

  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (move instanceof AttackMove && pokemon.getAttackTypeEffectiveness(move.type, attacker) < 2) {
      cancelled.value = true;
      (args[0] as Utils.NumberHolder).value = 0;
      return true;
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:nonSuperEffectiveImmunity", {
      pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
      abilityName
    });
  }
}

export class PostDefendAbAttr extends AbAttr {
  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

export class PostDefendDisguiseAbAttr extends PostDefendAbAttr {

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (pokemon.formIndex === 0 && pokemon.battleData.hitCount !== 0 && (move.category === MoveCategory.SPECIAL || move.category === MoveCategory.PHYSICAL)) {

      const recoilDamage = Math.ceil((pokemon.getMaxHp() / 8) - attacker.turnData.damageDealt);
      if (!recoilDamage) {
        return false;
      }
      pokemon.damageAndUpdate(recoilDamage, HitResult.OTHER);
      pokemon.turnData.damageTaken += recoilDamage;
      pokemon.scene.queueMessage(i18next.t("abilityTriggers:postDefendDisguise", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }));
      return true;
    }

    return false;
  }
}

export class PostDefendFormChangeAbAttr extends PostDefendAbAttr {
  private formFunc: (p: Pokemon) => integer;

  constructor(formFunc: ((p: Pokemon) => integer)) {
    super(true);

    this.formFunc = formFunc;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    const formIndex = this.formFunc(pokemon);
    if (formIndex !== pokemon.formIndex) {
      pokemon.scene.triggerPokemonFormChange(pokemon, SpeciesFormChangeManualTrigger, false);
      return true;
    }

    return false;
  }
}

export class FieldPriorityMoveImmunityAbAttr extends PreDefendAbAttr {
  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const attackPriority = new Utils.IntegerHolder(move.priority);
    applyMoveAttrs(IncrementMovePriorityAttr,attacker,null,move,attackPriority);
    applyAbAttrs(IncrementMovePriorityAbAttr, attacker, null, move, attackPriority);

    if (move.moveTarget===MoveTarget.USER || move.moveTarget===MoveTarget.NEAR_ALLY) {
      return false;
    }

    if (attackPriority.value > 0 && !move.isMultiTarget()) {
      cancelled.value = true;
      return true;
    }

    return false;
  }
}

export class PostStatChangeAbAttr extends AbAttr {
  applyPostStatChange(pokemon: Pokemon, statsChanged: BattleStat[], levelChanged: integer, selfTarget: boolean, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

export class MoveImmunityAbAttr extends PreDefendAbAttr {
  private immuneCondition: PreDefendAbAttrCondition;

  constructor(immuneCondition: PreDefendAbAttrCondition) {
    super(true);

    this.immuneCondition = immuneCondition;
  }

  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.immuneCondition(pokemon, attacker, move)) {
      cancelled.value = true;
      return true;
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:moveImmunity", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) });
  }
}

/**
 * Reduces the accuracy of status moves used against the Pokémon with this ability to 50%.
 * Used by Wonder Skin.
 *
 * @extends PreDefendAbAttr
 */
export class WonderSkinAbAttr extends PreDefendAbAttr {
  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const moveAccuracy = args[0] as Utils.NumberHolder;
    if (move.category === MoveCategory.STATUS && moveAccuracy.value >= 50) {
      moveAccuracy.value = 50;
      return true;
    }

    return false;
  }
}

export class MoveImmunityStatChangeAbAttr extends MoveImmunityAbAttr {
  private stat: BattleStat;
  private levels: integer;

  constructor(immuneCondition: PreDefendAbAttrCondition, stat: BattleStat, levels: integer) {
    super(immuneCondition);
    this.stat = stat;
    this.levels = levels;
  }

  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const ret = super.applyPreDefend(pokemon, passive, attacker, move, cancelled, args);
    if (ret) {
      const simulated = args.length > 1 && args[1];
      if (!simulated) {
        pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, [ this.stat ], this.levels));
      }
    }

    return ret;
  }
}
/**
 * Class for abilities that make drain moves deal damage to user instead of healing them.
 * @extends PostDefendAbAttr
 * @see {@linkcode applyPostDefend}
 */
export class ReverseDrainAbAttr extends PostDefendAbAttr {
  /**
   * Determines if a damage and draining move was used to check if this ability should stop the healing.
   * Examples include: Absorb, Draining Kiss, Bitter Blade, etc.
   * Also displays a message to show this ability was activated.
   * @param pokemon {@linkcode Pokemon} with this ability
   * @param passive N/A
   * @param attacker {@linkcode Pokemon} that is attacking this Pokemon
   * @param move {@linkcode PokemonMove} that is being used
   * @param hitResult N/A
   * @args N/A
   * @returns true if healing should be reversed on a healing move, false otherwise.
   */
  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (move.hasAttr(HitHealAttr)) {
      pokemon.scene.queueMessage(i18next.t("abilityTriggers:reverseDrain", { pokemonNameWithAffix: getPokemonNameWithAffix(attacker) }));
      return true;
    }
    return false;
  }
}

export class PostDefendStatChangeAbAttr extends PostDefendAbAttr {
  private condition: PokemonDefendCondition;
  private stat: BattleStat;
  private levels: integer;
  private selfTarget: boolean;
  private allOthers: boolean;

  constructor(condition: PokemonDefendCondition, stat: BattleStat, levels: integer, selfTarget: boolean = true, allOthers: boolean = false) {
    super(true);

    this.condition = condition;
    this.stat = stat;
    this.levels = levels;
    this.selfTarget = selfTarget;
    this.allOthers = allOthers;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (this.condition(pokemon, attacker, move)) {
      if (this.allOthers) {
        const otherPokemon = pokemon.getAlly() ? pokemon.getOpponents().concat([ pokemon.getAlly() ]) : pokemon.getOpponents();
        for (const other of otherPokemon) {
          other.scene.unshiftPhase(new StatChangePhase(other.scene, (other).getBattlerIndex(), false, [ this.stat ], this.levels));
        }
        return true;
      }
      pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, (this.selfTarget ? pokemon : attacker).getBattlerIndex(), this.selfTarget, [ this.stat ], this.levels));
      return true;
    }

    return false;
  }
}

export class PostDefendHpGatedStatChangeAbAttr extends PostDefendAbAttr {
  private condition: PokemonDefendCondition;
  private hpGate: number;
  private stats: BattleStat[];
  private levels: integer;
  private selfTarget: boolean;

  constructor(condition: PokemonDefendCondition, hpGate: number, stats: BattleStat[], levels: integer, selfTarget: boolean = true) {
    super(true);

    this.condition = condition;
    this.hpGate = hpGate;
    this.stats = stats;
    this.levels = levels;
    this.selfTarget = selfTarget;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    const hpGateFlat: integer = Math.ceil(pokemon.getMaxHp() * this.hpGate);
    const lastAttackReceived = pokemon.turnData.attacksReceived[pokemon.turnData.attacksReceived.length - 1];
    const damageReceived = lastAttackReceived?.damage || 0;

    if (this.condition(pokemon, attacker, move) && (pokemon.hp <= hpGateFlat && (pokemon.hp + damageReceived) > hpGateFlat)) {
      pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, (this.selfTarget ? pokemon : attacker).getBattlerIndex(), true, this.stats, this.levels));
      return true;
    }

    return false;
  }
}

export class PostDefendApplyArenaTrapTagAbAttr extends PostDefendAbAttr {
  private condition: PokemonDefendCondition;
  private tagType: ArenaTagType;

  constructor(condition: PokemonDefendCondition, tagType: ArenaTagType) {
    super(true);

    this.condition = condition;
    this.tagType = tagType;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (this.condition(pokemon, attacker, move)) {
      const tag = pokemon.scene.arena.getTag(this.tagType) as ArenaTrapTag;
      if (!pokemon.scene.arena.getTag(this.tagType) || tag.layers < tag.maxLayers) {
        pokemon.scene.arena.addTag(this.tagType, 0, undefined, pokemon.id, pokemon.isPlayer() ? ArenaTagSide.ENEMY : ArenaTagSide.PLAYER);
        return true;
      }
    }
    return false;
  }
}

export class PostDefendApplyBattlerTagAbAttr extends PostDefendAbAttr {
  private condition: PokemonDefendCondition;
  private tagType: BattlerTagType;
  constructor(condition: PokemonDefendCondition, tagType: BattlerTagType) {
    super(true);

    this.condition = condition;
    this.tagType = tagType;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (this.condition(pokemon, attacker, move)) {
      if (!pokemon.getTag(this.tagType)) {
        pokemon.addTag(this.tagType, undefined, undefined, pokemon.id);
        pokemon.scene.queueMessage(i18next.t("abilityTriggers:windPowerCharged", { pokemonName: getPokemonNameWithAffix(pokemon), moveName: move.name }));
      }
      return true;
    }
    return false;
  }
}

export class PostDefendTypeChangeAbAttr extends PostDefendAbAttr {
  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (hitResult < HitResult.NO_EFFECT) {
      const type = move.type;
      const pokemonTypes = pokemon.getTypes(true);
      if (pokemonTypes.length !== 1 || pokemonTypes[0] !== type) {
        pokemon.summonData.types = [ type ];
        return true;
      }
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:postDefendTypeChange", {
      pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
      abilityName,
      typeName: i18next.t(`pokemonInfo:Type.${Type[pokemon.getTypes(true)[0]]}`)
    });
  }
}

export class PostDefendTerrainChangeAbAttr extends PostDefendAbAttr {
  private terrainType: TerrainType;

  constructor(terrainType: TerrainType) {
    super();

    this.terrainType = terrainType;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (hitResult < HitResult.NO_EFFECT) {
      return pokemon.scene.arena.trySetTerrain(this.terrainType, true);
    }

    return false;
  }
}

export class PostDefendContactApplyStatusEffectAbAttr extends PostDefendAbAttr {
  private chance: integer;
  private effects: StatusEffect[];

  constructor(chance: integer, ...effects: StatusEffect[]) {
    super();

    this.chance = chance;
    this.effects = effects;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon) && !attacker.status && (this.chance === -1 || pokemon.randSeedInt(100) < this.chance)) {
      const effect = this.effects.length === 1 ? this.effects[0] : this.effects[pokemon.randSeedInt(this.effects.length)];
      return attacker.trySetStatus(effect, true, pokemon);
    }

    return false;
  }
}

export class EffectSporeAbAttr extends PostDefendContactApplyStatusEffectAbAttr {
  constructor() {
    super(10, StatusEffect.POISON, StatusEffect.PARALYSIS, StatusEffect.SLEEP);
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (attacker.hasAbility(Abilities.OVERCOAT) || attacker.isOfType(Type.GRASS)) {
      return false;
    }
    return super.applyPostDefend(pokemon, passive, attacker, move, hitResult, args);
  }
}

export class PostDefendContactApplyTagChanceAbAttr extends PostDefendAbAttr {
  private chance: integer;
  private tagType: BattlerTagType;
  private turnCount: integer;

  constructor(chance: integer, tagType: BattlerTagType, turnCount?: integer) {
    super();

    this.tagType = tagType;
    this.chance = chance;
    this.turnCount = turnCount;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon) && pokemon.randSeedInt(100) < this.chance) {
      return attacker.addTag(this.tagType, this.turnCount, move.id, attacker.id);
    }

    return false;
  }
}

export class PostDefendCritStatChangeAbAttr extends PostDefendAbAttr {
  private stat: BattleStat;
  private levels: integer;

  constructor(stat: BattleStat, levels: integer) {
    super();

    this.stat = stat;
    this.levels = levels;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, [ this.stat ], this.levels));

    return true;
  }

  getCondition(): AbAttrCondition {
    return (pokemon: Pokemon) => pokemon.turnData.attacksReceived.length && pokemon.turnData.attacksReceived[pokemon.turnData.attacksReceived.length - 1].critical;
  }
}

export class PostDefendContactDamageAbAttr extends PostDefendAbAttr {
  private damageRatio: integer;

  constructor(damageRatio: integer) {
    super();

    this.damageRatio = damageRatio;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon) && !attacker.hasAbilityWithAttr(BlockNonDirectDamageAbAttr)) {
      attacker.damageAndUpdate(Math.ceil(attacker.getMaxHp() * (1 / this.damageRatio)), HitResult.OTHER);
      attacker.turnData.damageTaken += Math.ceil(attacker.getMaxHp() * (1 / this.damageRatio));
      return true;
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:postDefendContactDamage", {
      pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
      abilityName
    });
  }
}
/**
 * @description: This ability applies the Perish Song tag to the attacking pokemon
 * and the defending pokemon if the move makes physical contact and neither pokemon
 * already has the Perish Song tag.
 * @class PostDefendPerishSongAbAttr
 * @extends {PostDefendAbAttr}
 */
export class PostDefendPerishSongAbAttr extends PostDefendAbAttr {
  private turns: integer;

  constructor(turns: integer) {
    super();

    this.turns = turns;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon)) {
      if (pokemon.getTag(BattlerTagType.PERISH_SONG) || attacker.getTag(BattlerTagType.PERISH_SONG)) {
        return false;
      } else {
        attacker.addTag(BattlerTagType.PERISH_SONG, this.turns);
        pokemon.addTag(BattlerTagType.PERISH_SONG, this.turns);
        return true;
      }
    }
    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:perishBody", {pokemonName: getPokemonNameWithAffix(pokemon), abilityName: abilityName});
  }
}

export class PostDefendWeatherChangeAbAttr extends PostDefendAbAttr {
  private weatherType: WeatherType;

  constructor(weatherType: WeatherType) {
    super();

    this.weatherType = weatherType;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (!pokemon.scene.arena.weather?.isImmutable()) {
      return pokemon.scene.arena.trySetWeather(this.weatherType, true);
    }

    return false;
  }
}

export class PostDefendAbilitySwapAbAttr extends PostDefendAbAttr {
  constructor() {
    super();
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon) && !attacker.getAbility().hasAttr(UnswappableAbilityAbAttr)) {
      const tempAbilityId = attacker.getAbility().id;
      attacker.summonData.ability = pokemon.getAbility().id;
      pokemon.summonData.ability = tempAbilityId;
      return true;
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:postDefendAbilitySwap", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) });
  }
}

export class PostDefendAbilityGiveAbAttr extends PostDefendAbAttr {
  private ability: Abilities;

  constructor(ability: Abilities) {
    super();
    this.ability = ability;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon) && !attacker.getAbility().hasAttr(UnsuppressableAbilityAbAttr) && !attacker.getAbility().hasAttr(PostDefendAbilityGiveAbAttr)) {
      attacker.summonData.ability = this.ability;

      return true;
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:postDefendAbilityGive", {
      pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
      abilityName
    });
  }
}

export class PostDefendMoveDisableAbAttr extends PostDefendAbAttr {
  private chance: integer;
  private attacker: Pokemon;
  private move: Move;

  constructor(chance: integer) {
    super();

    this.chance = chance;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (!attacker.summonData.disabledMove) {
      if (move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon) && (this.chance === -1 || pokemon.randSeedInt(100) < this.chance) && !attacker.isMax()) {
        this.attacker = attacker;
        this.move = move;

        attacker.summonData.disabledMove = move.id;
        attacker.summonData.disabledTurns = 4;
        return true;
      }
    }
    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:postDefendMoveDisable", {
      pokemonNameWithAffix: getPokemonNameWithAffix(this.attacker),
      moveName: this.move.name,
    });
  }
}

export class PostStatChangeStatChangeAbAttr extends PostStatChangeAbAttr {
  private condition: PokemonStatChangeCondition;
  private statsToChange: BattleStat[];
  private levels: integer;

  constructor(condition: PokemonStatChangeCondition, statsToChange: BattleStat[], levels: integer) {
    super(true);

    this.condition = condition;
    this.statsToChange = statsToChange;
    this.levels = levels;
  }

  applyPostStatChange(pokemon: Pokemon, statsChanged: BattleStat[], levelsChanged: integer, selfTarget: boolean, args: any[]): boolean {
    if (this.condition(pokemon, statsChanged, levelsChanged) && !selfTarget) {
      pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, (pokemon).getBattlerIndex(), true, this.statsToChange, this.levels));
      return true;
    }

    return false;
  }
}

export class PreAttackAbAttr extends AbAttr {
  applyPreAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

/**
 * Modifies moves additional effects with multipliers, ie. Sheer Force, Serene Grace.
 * @extends AbAttr
 * @see {@linkcode apply}
 */
export class MoveEffectChanceMultiplierAbAttr extends AbAttr {
  private chanceMultiplier: number;

  constructor(chanceMultiplier?: number) {
    super(true);
    this.chanceMultiplier = chanceMultiplier;
  }
  /**
   * @param args [0]: {@linkcode Utils.NumberHolder} Move additional effect chance. Has to be higher than or equal to 0.
   *             [1]: {@linkcode Moves } Move used by the ability user.
   */
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    // Disable showAbility during getTargetBenefitScore
    this.showAbility = args[4];
    if ((args[0] as Utils.NumberHolder).value <= 0 || (args[1] as Move).id === Moves.ORDER_UP) {
      return false;
    }

    (args[0] as Utils.NumberHolder).value *= this.chanceMultiplier;
    (args[0] as Utils.NumberHolder).value = Math.min((args[0] as Utils.NumberHolder).value, 100);
    return true;

  }
}

/**
 * Sets incoming moves additional effect chance to zero, ignoring all effects from moves. ie. Shield Dust.
 * @extends PreDefendAbAttr
 * @see {@linkcode applyPreDefend}
 */
export class IgnoreMoveEffectsAbAttr extends PreDefendAbAttr {
  /**
   * @param args [0]: {@linkcode Utils.NumberHolder} Move additional effect chance.
   */
  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {

    if ((args[0] as Utils.NumberHolder).value <= 0) {
      return false;
    }

    (args[0] as Utils.NumberHolder).value = 0;
    return true;

  }
}

export class VariableMovePowerAbAttr extends PreAttackAbAttr {
  applyPreAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, args: any[]): boolean {
    //const power = args[0] as Utils.NumberHolder;
    return false;
  }
}

export class FieldPreventExplosiveMovesAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean | Promise<boolean> {
    cancelled.value = true;
    return true;
  }
}

/**
 * Multiplies a BattleStat if the checked Pokemon lacks this ability.
 * If this ability cannot stack, a BooleanHolder can be used to prevent this from stacking.
 * @see {@link applyFieldBattleStatMultiplierAbAttrs}
 * @see {@link applyFieldBattleStat}
 * @see {@link Utils.BooleanHolder}
 */
export class FieldMultiplyBattleStatAbAttr extends AbAttr {
  private stat: Stat;
  private multiplier: number;
  private canStack: boolean;

  constructor(stat: Stat, multiplier: number, canStack: boolean = false) {
    super(false);

    this.stat = stat;
    this.multiplier = multiplier;
    this.canStack = canStack;
  }

  /**
   * applyFieldBattleStat: Tries to multiply a Pokemon's BattleStat
   * @param pokemon {@linkcode Pokemon} the Pokemon using this ability
   * @param passive {@linkcode boolean} unused
   * @param stat {@linkcode Stat} the type of the checked stat
   * @param statValue {@linkcode Utils.NumberHolder} the value of the checked stat
   * @param checkedPokemon {@linkcode Pokemon} the Pokemon this ability is targeting
   * @param hasApplied {@linkcode Utils.BooleanHolder} whether or not another multiplier has been applied to this stat
   * @param args {any[]} unused
   * @returns true if this changed the checked stat, false otherwise.
   */
  applyFieldBattleStat(pokemon: Pokemon, passive: boolean, stat: Stat, statValue: Utils.NumberHolder, checkedPokemon: Pokemon, hasApplied: Utils.BooleanHolder, args: any[]): boolean {
    if (!this.canStack && hasApplied.value) {
      return false;
    }

    if (this.stat === stat && checkedPokemon.getAbilityAttrs(FieldMultiplyBattleStatAbAttr).every(attr => (attr as FieldMultiplyBattleStatAbAttr).stat !== stat)) {
      statValue.value *= this.multiplier;
      hasApplied.value = true;
      return true;
    }
    return false;
  }

}

export class MoveTypeChangeAttr extends PreAttackAbAttr {
  constructor(
    private newType: Type,
    private powerMultiplier: number,
    private condition?: PokemonAttackCondition
  ) {
    super(true);
  }

  applyPreAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, args: any[]): boolean {
    if (this.condition && this.condition(pokemon, defender, move)) {
      move.type = this.newType;
      if (args[0] && args[0] instanceof Utils.NumberHolder) {
        args[0].value *= this.powerMultiplier;
      }
      return true;
    }

    return false;
  }
}

/** Ability attribute for changing a pokemon's type before using a move */
export class PokemonTypeChangeAbAttr extends PreAttackAbAttr {
  private moveType: Type;

  constructor() {
    super(true);
  }

  applyPreAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, args: any[]): boolean {
    if (
      !pokemon.isTerastallized() &&
      move.id !== Moves.STRUGGLE &&
      /**
       * Skip moves that call other moves because these moves generate a following move that will trigger this ability attribute
       * @see {@link https://bulbapedia.bulbagarden.net/wiki/Category:Moves_that_call_other_moves}
       */
      !move.findAttr((attr) =>
        attr instanceof RandomMovesetMoveAttr ||
        attr instanceof RandomMoveAttr ||
        attr instanceof NaturePowerAttr ||
        attr instanceof CopyMoveAttr
      )
    ) {
      // TODO remove this copy when phase order is changed so that damage, type, category, etc.
      // TODO are all calculated prior to playing the move animation.
      const moveCopy = new Move(move.id, move.type, move.category, move.moveTarget, move.power, move.accuracy, move.pp, move.chance, move.priority, move.generation);
      moveCopy.attrs = move.attrs;

      // Moves like Weather Ball ignore effects of abilities like Normalize and Refrigerate
      if (move.findAttr(attr => attr instanceof VariableMoveTypeAttr)) {
        applyMoveAttrs(VariableMoveTypeAttr, pokemon, null, moveCopy);
      } else {
        applyPreAttackAbAttrs(MoveTypeChangeAttr, pokemon, null, moveCopy);
      }

      if (pokemon.getTypes().some((t) => t !== moveCopy.type)) {
        this.moveType = moveCopy.type;
        pokemon.summonData.types = [moveCopy.type];
        pokemon.updateInfo();

        return true;
      }
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:pokemonTypeChange", {
      pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
      moveType: i18next.t(`pokemonInfo:Type.${Type[this.moveType]}`),
    });
  }
}

/**
 * Class for abilities that convert single-strike moves to two-strike moves (i.e. Parental Bond).
 * @param damageMultiplier the damage multiplier for the second strike, relative to the first.
 */
export class AddSecondStrikeAbAttr extends PreAttackAbAttr {
  private damageMultiplier: number;

  constructor(damageMultiplier: number) {
    super(false);

    this.damageMultiplier = damageMultiplier;
  }

  /**
   * Determines whether this attribute can apply to a given move.
   * @param {Move} move the move to which this attribute may apply
   * @param numTargets the number of {@linkcode Pokemon} targeted by this move
   * @returns true if the attribute can apply to the move, false otherwise
   */
  canApplyPreAttack(move: Move, numTargets: integer): boolean {
    /**
     * Parental Bond cannot apply to multi-hit moves, charging moves, or
     * moves that cause the user to faint.
     */
    const exceptAttrs: Constructor<MoveAttr>[] = [
      MultiHitAttr,
      ChargeAttr,
      SacrificialAttr,
      SacrificialAttrOnHit
    ];

    /** Parental Bond cannot apply to these specific moves */
    const exceptMoves: Moves[] = [
      Moves.FLING,
      Moves.UPROAR,
      Moves.ROLLOUT,
      Moves.ICE_BALL,
      Moves.ENDEAVOR
    ];

    /** Also check if this move is an Attack move and if it's only targeting one Pokemon */
    return numTargets === 1
      && !exceptAttrs.some(attr => move.hasAttr(attr))
      && !exceptMoves.some(id => move.id === id)
      && move.category !== MoveCategory.STATUS;
  }

  /**
   * If conditions are met, this doubles the move's hit count (via args[1])
   * or multiplies the damage of secondary strikes (via args[2])
   * @param {Pokemon} pokemon the Pokemon using the move
   * @param passive n/a
   * @param defender n/a
   * @param {Move} move the move used by the ability source
   * @param args\[0\] the number of Pokemon this move is targeting
   * @param {Utils.IntegerHolder} args\[1\] the number of strikes with this move
   * @param {Utils.NumberHolder} args\[2\] the damage multiplier for the current strike
   * @returns
   */
  applyPreAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, args: any[]): boolean {
    const numTargets = args[0] as integer;
    const hitCount = args[1] as Utils.IntegerHolder;
    const multiplier = args[2] as Utils.NumberHolder;

    if (this.canApplyPreAttack(move, numTargets)) {
      this.showAbility = !!hitCount?.value;
      if (!!hitCount?.value) {
        hitCount.value *= 2;
      }

      if (!!multiplier?.value && pokemon.turnData.hitsLeft % 2 === 1 && pokemon.turnData.hitsLeft !== pokemon.turnData.hitCount) {
        multiplier.value *= this.damageMultiplier;
      }
      return true;
    }
    return false;
  }
}

/**
 * Class for abilities that boost the damage of moves
 * For abilities that boost the base power of moves, see VariableMovePowerAbAttr
 * @param damageMultiplier the amount to multiply the damage by
 * @param condition the condition for this ability to be applied
 */
export class DamageBoostAbAttr extends PreAttackAbAttr {
  private damageMultiplier: number;
  private condition: PokemonAttackCondition;

  constructor(damageMultiplier: number, condition: PokemonAttackCondition) {
    super(true);
    this.damageMultiplier = damageMultiplier;
    this.condition = condition;
  }

  /**
   *
   * @param pokemon the attacker pokemon
   * @param passive N/A
   * @param defender the target pokemon
   * @param move the move used by the attacker pokemon
   * @param args Utils.NumberHolder as damage
   * @returns true if the function succeeds
   */
  applyPreAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, args: any[]): boolean {
    if (this.condition(pokemon, defender, move)) {
      const power = args[0] as Utils.NumberHolder;
      power.value = Math.floor(power.value * this.damageMultiplier);
      return true;
    }

    return false;
  }
}

export class MovePowerBoostAbAttr extends VariableMovePowerAbAttr {
  private condition: PokemonAttackCondition;
  private powerMultiplier: number;

  constructor(condition: PokemonAttackCondition, powerMultiplier: number, showAbility: boolean = true) {
    super(showAbility);
    this.condition = condition;
    this.powerMultiplier = powerMultiplier;
  }

  applyPreAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, args: any[]): boolean {
    if (this.condition(pokemon, defender, move)) {
      (args[0] as Utils.NumberHolder).value *= this.powerMultiplier;

      return true;
    }

    return false;
  }
}

export class MoveTypePowerBoostAbAttr extends MovePowerBoostAbAttr {
  constructor(boostedType: Type, powerMultiplier?: number) {
    super((pokemon, defender, move) => move.type === boostedType, powerMultiplier || 1.5);
  }
}

export class LowHpMoveTypePowerBoostAbAttr extends MoveTypePowerBoostAbAttr {
  constructor(boostedType: Type) {
    super(boostedType);
  }

  getCondition(): AbAttrCondition {
    return (pokemon) => pokemon.getHpRatio() <= 0.33;
  }
}

/**
 * Abilities which cause a variable amount of power increase.
 * @extends VariableMovePowerAbAttr
 * @see {@link applyPreAttack}
 */
export class VariableMovePowerBoostAbAttr extends VariableMovePowerAbAttr {
  private mult: (user: Pokemon, target: Pokemon, move: Move) => number;

  /**
   * @param mult A function which takes the user, target, and move, and returns the power multiplier. 1 means no multiplier.
   * @param {boolean} showAbility Whether to show the ability when it activates.
   */
  constructor(mult: (user: Pokemon, target: Pokemon, move: Move) => number, showAbility: boolean = true) {
    super(showAbility);
    this.mult = mult;
  }

  /**
   * @override
   */
  applyPreAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move, args: any[]): boolean {
    const multiplier = this.mult(pokemon, defender, move);
    if (multiplier !== 1) {
      (args[0] as Utils.NumberHolder).value *= multiplier;
      return true;
    }

    return false;
  }
}

/**
 * Boosts the power of a Pokémon's move under certain conditions.
 * @extends AbAttr
 */
export class FieldMovePowerBoostAbAttr extends AbAttr {
  private condition: PokemonAttackCondition;
  private powerMultiplier: number;

  /**
   * @param condition - A function that determines whether the power boost condition is met.
   * @param powerMultiplier - The multiplier to apply to the move's power when the condition is met.
   */
  constructor(condition: PokemonAttackCondition, powerMultiplier: number) {
    super(false);
    this.condition = condition;
    this.powerMultiplier = powerMultiplier;
  }

  applyPreAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, args: any[]): boolean {
    if (this.condition(pokemon, defender, move)) {
      (args[0] as Utils.NumberHolder).value *= this.powerMultiplier;

      return true;
    }

    return false;
  }
}

/**
 * Boosts the power of a specific type of move.
 * @extends FieldMovePowerBoostAbAttr
 */
export class PreAttackFieldMoveTypePowerBoostAbAttr extends FieldMovePowerBoostAbAttr {
  /**
   * @param boostedType - The type of move that will receive the power boost.
   * @param powerMultiplier - The multiplier to apply to the move's power, defaults to 1.5 if not provided.
   */
  constructor(boostedType: Type, powerMultiplier?: number) {
    super((pokemon, defender, move) => move.type === boostedType, powerMultiplier || 1.5);
  }
}

/**
 * Boosts the power of a specific type of move for all Pokemon in the field.
 * @extends PreAttackFieldMoveTypePowerBoostAbAttr
 */
export class FieldMoveTypePowerBoostAbAttr extends PreAttackFieldMoveTypePowerBoostAbAttr { }

/**
 * Boosts the power of a specific type of move for the user and its allies.
 * @extends PreAttackFieldMoveTypePowerBoostAbAttr
 */
export class UserFieldMoveTypePowerBoostAbAttr extends PreAttackFieldMoveTypePowerBoostAbAttr { }

/**
 * Boosts the power of moves in specified categories.
 * @extends FieldMovePowerBoostAbAttr
 */
export class AllyMoveCategoryPowerBoostAbAttr extends FieldMovePowerBoostAbAttr {
  /**
   * @param boostedCategories - The categories of moves that will receive the power boost.
   * @param powerMultiplier - The multiplier to apply to the move's power.
   */
  constructor(boostedCategories: MoveCategory[], powerMultiplier: number) {
    super((pokemon, defender, move) => boostedCategories.includes(move.category), powerMultiplier);
  }
}

export class BattleStatMultiplierAbAttr extends AbAttr {
  private battleStat: BattleStat;
  private multiplier: number;
  private condition: PokemonAttackCondition;

  constructor(battleStat: BattleStat, multiplier: number, condition?: PokemonAttackCondition) {
    super(false);

    this.battleStat = battleStat;
    this.multiplier = multiplier;
    this.condition = condition;
  }

  applyBattleStat(pokemon: Pokemon, passive: boolean, battleStat: BattleStat, statValue: Utils.NumberHolder, args: any[]): boolean | Promise<boolean> {
    const move = (args[0] as Move);
    if (battleStat === this.battleStat && (!this.condition || this.condition(pokemon, null, move))) {
      statValue.value *= this.multiplier;
      return true;
    }

    return false;
  }
}

export class PostAttackAbAttr extends AbAttr {
  private attackCondition: PokemonAttackCondition;

  /** The default attackCondition requires that the selected move is a damaging move */
  constructor(attackCondition: PokemonAttackCondition = (user, target, move) => (move.category !== MoveCategory.STATUS)) {
    super();

    this.attackCondition = attackCondition;
  }

  /**
   * Please override {@link applyPostAttackAfterMoveTypeCheck} instead of this method. By default, this method checks that the move used is a damaging attack before
   * applying the effect of any inherited class. This can be changed by providing a different {@link attackCondition} to the constructor. See {@link ConfusionOnStatusEffectAbAttr}
   * for an example of an effect that does not require a damaging move.
   */
  applyPostAttack(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean | Promise<boolean> {
    // When attackRequired is true, we require the move to be an attack move and to deal damage before checking secondary requirements.
    // If attackRequired is false, we always defer to the secondary requirements.
    if (this.attackCondition(pokemon, defender, move)) {
      return this.applyPostAttackAfterMoveTypeCheck(pokemon, passive, defender, move, hitResult, args);
    } else {
      return false;
    }
  }

  /**
   * This method is only called after {@link applyPostAttack} has already been applied. Use this for handling checks specific to the ability in question.
   */
  applyPostAttackAfterMoveTypeCheck(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

export class PostAttackStealHeldItemAbAttr extends PostAttackAbAttr {
  private stealCondition: PokemonAttackCondition;

  constructor(stealCondition?: PokemonAttackCondition) {
    super();

    this.stealCondition = stealCondition;
  }

  applyPostAttackAfterMoveTypeCheck(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, hitResult: HitResult, args: any[]): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      if (hitResult < HitResult.NO_EFFECT && (!this.stealCondition || this.stealCondition(pokemon, defender, move))) {
        const heldItems = this.getTargetHeldItems(defender).filter(i => i.isTransferrable);
        if (heldItems.length) {
          const stolenItem = heldItems[pokemon.randSeedInt(heldItems.length)];
          pokemon.scene.tryTransferHeldItemModifier(stolenItem, pokemon, false).then(success => {
            if (success) {
              pokemon.scene.queueMessage(i18next.t("abilityTriggers:postAttackStealHeldItem", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), defenderName: defender.name, stolenItemType: stolenItem.type.name }));
            }
            resolve(success);
          });
          return;
        }
      }
      resolve(false);
    });
  }

  getTargetHeldItems(target: Pokemon): PokemonHeldItemModifier[] {
    return target.scene.findModifiers(m => m instanceof PokemonHeldItemModifier
      && m.pokemonId === target.id, target.isPlayer()) as PokemonHeldItemModifier[];
  }
}

export class PostAttackApplyStatusEffectAbAttr extends PostAttackAbAttr {
  private contactRequired: boolean;
  private chance: integer;
  private effects: StatusEffect[];

  constructor(contactRequired: boolean, chance: integer, ...effects: StatusEffect[]) {
    super();

    this.contactRequired = contactRequired;
    this.chance = chance;
    this.effects = effects;
  }

  applyPostAttackAfterMoveTypeCheck(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    /**Status inflicted by abilities post attacking are also considered additional effects.*/
    if (!attacker.hasAbilityWithAttr(IgnoreMoveEffectsAbAttr) && pokemon !== attacker && (!this.contactRequired || move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon)) && pokemon.randSeedInt(100) < this.chance && !pokemon.status) {
      const effect = this.effects.length === 1 ? this.effects[0] : this.effects[pokemon.randSeedInt(this.effects.length)];
      return attacker.trySetStatus(effect, true, pokemon);
    }

    return false;
  }
}

export class PostAttackContactApplyStatusEffectAbAttr extends PostAttackApplyStatusEffectAbAttr {
  constructor(chance: integer, ...effects: StatusEffect[]) {
    super(true, chance, ...effects);
  }
}

export class PostAttackApplyBattlerTagAbAttr extends PostAttackAbAttr {
  private contactRequired: boolean;
  private chance: (user: Pokemon, target: Pokemon, move: Move) => integer;
  private effects: BattlerTagType[];


  constructor(contactRequired: boolean, chance: (user: Pokemon, target: Pokemon, move: Move) =>  integer, ...effects: BattlerTagType[]) {
    super();

    this.contactRequired = contactRequired;
    this.chance = chance;
    this.effects = effects;
  }

  applyPostAttackAfterMoveTypeCheck(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    /**Battler tags inflicted by abilities post attacking are also considered additional effects.*/
    if (!attacker.hasAbilityWithAttr(IgnoreMoveEffectsAbAttr) && pokemon !== attacker && (!this.contactRequired || move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon)) && pokemon.randSeedInt(100) < this.chance(attacker, pokemon, move) && !pokemon.status) {
      const effect = this.effects.length === 1 ? this.effects[0] : this.effects[pokemon.randSeedInt(this.effects.length)];
      return attacker.addTag(effect);
    }

    return false;
  }
}

export class PostDefendStealHeldItemAbAttr extends PostDefendAbAttr {
  private condition: PokemonDefendCondition;

  constructor(condition?: PokemonDefendCondition) {
    super();

    this.condition = condition;
  }

  applyPostDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      if (hitResult < HitResult.NO_EFFECT && (!this.condition || this.condition(pokemon, attacker, move))) {
        const heldItems = this.getTargetHeldItems(attacker).filter(i => i.isTransferrable);
        if (heldItems.length) {
          const stolenItem = heldItems[pokemon.randSeedInt(heldItems.length)];
          pokemon.scene.tryTransferHeldItemModifier(stolenItem, pokemon, false).then(success => {
            if (success) {
              pokemon.scene.queueMessage(i18next.t("abilityTriggers:postDefendStealHeldItem", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), attackerName: attacker.name, stolenItemType: stolenItem.type.name }));
            }
            resolve(success);
          });
          return;
        }
      }
      resolve(false);
    });
  }

  getTargetHeldItems(target: Pokemon): PokemonHeldItemModifier[] {
    return target.scene.findModifiers(m => m instanceof PokemonHeldItemModifier
      && m.pokemonId === target.id, target.isPlayer()) as PokemonHeldItemModifier[];
  }
}

export class PostVictoryAbAttr extends AbAttr {
  applyPostVictory(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

class PostVictoryStatChangeAbAttr extends PostVictoryAbAttr {
  private stat: BattleStat | ((p: Pokemon) => BattleStat);
  private levels: integer;

  constructor(stat: BattleStat | ((p: Pokemon) => BattleStat), levels: integer) {
    super();

    this.stat = stat;
    this.levels = levels;
  }

  applyPostVictory(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    const stat = typeof this.stat === "function"
      ? this.stat(pokemon)
      : this.stat;
    pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, [ stat ], this.levels));

    return true;
  }
}

export class PostVictoryFormChangeAbAttr extends PostVictoryAbAttr {
  private formFunc: (p: Pokemon) => integer;

  constructor(formFunc: ((p: Pokemon) => integer)) {
    super(true);

    this.formFunc = formFunc;
  }

  applyPostVictory(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    const formIndex = this.formFunc(pokemon);
    if (formIndex !== pokemon.formIndex) {
      pokemon.scene.triggerPokemonFormChange(pokemon, SpeciesFormChangeManualTrigger, false);
      return true;
    }

    return false;
  }
}

export class PostKnockOutAbAttr extends AbAttr {
  applyPostKnockOut(pokemon: Pokemon, passive: boolean, knockedOut: Pokemon, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

export class PostKnockOutStatChangeAbAttr extends PostKnockOutAbAttr {
  private stat: BattleStat | ((p: Pokemon) => BattleStat);
  private levels: integer;

  constructor(stat: BattleStat | ((p: Pokemon) => BattleStat), levels: integer) {
    super();

    this.stat = stat;
    this.levels = levels;
  }

  applyPostKnockOut(pokemon: Pokemon, passive: boolean, knockedOut: Pokemon, args: any[]): boolean | Promise<boolean> {
    const stat = typeof this.stat === "function"
      ? this.stat(pokemon)
      : this.stat;
    pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, [ stat ], this.levels));

    return true;
  }
}

export class CopyFaintedAllyAbilityAbAttr extends PostKnockOutAbAttr {
  constructor() {
    super();
  }

  applyPostKnockOut(pokemon: Pokemon, passive: boolean, knockedOut: Pokemon, args: any[]): boolean | Promise<boolean> {
    if (pokemon.isPlayer() === knockedOut.isPlayer() && !knockedOut.getAbility().hasAttr(UncopiableAbilityAbAttr)) {
      pokemon.summonData.ability = knockedOut.getAbility().id;
      pokemon.scene.queueMessage(i18next.t("abilityTriggers:copyFaintedAllyAbility", { pokemonNameWithAffix: getPokemonNameWithAffix(knockedOut), abilityName: allAbilities[knockedOut.getAbility().id].name }));
      return true;
    }

    return false;
  }
}

export class IgnoreOpponentStatChangesAbAttr extends AbAttr {
  constructor() {
    super(false);
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]) {
    (args[0] as Utils.IntegerHolder).value = 0;

    return true;
  }
}
/**
 * Ignores opponent's evasion stat changes when determining if a move hits or not
 * @extends AbAttr
 * @see {@linkcode apply}
 */
export class IgnoreOpponentEvasionAbAttr extends AbAttr {
  constructor() {
    super(false);
  }
  /**
   * Checks if enemy Pokemon is trapped by an Arena Trap-esque ability
   * @param pokemon N/A
   * @param passive N/A
   * @param cancelled N/A
   * @param args [0] {@linkcode Utils.IntegerHolder} of BattleStat.EVA
   * @returns if evasion level was successfully considered as 0
   */
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]) {
    (args[0] as Utils.IntegerHolder).value = 0;
    return true;
  }
}

export class IntimidateImmunityAbAttr extends AbAttr {
  constructor() {
    super(false);
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    cancelled.value = true;
    return true;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:intimidateImmunity", {
      pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
      abilityName
    });
  }
}

export class PostIntimidateStatChangeAbAttr extends AbAttr {
  private stats: BattleStat[];
  private levels: integer;
  private overwrites: boolean;

  constructor(stats: BattleStat[], levels: integer, overwrites?: boolean) {
    super(true);
    this.stats = stats;
    this.levels = levels;
    this.overwrites = !!overwrites;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    pokemon.scene.pushPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), false, this.stats, this.levels));
    cancelled.value = this.overwrites;
    return true;
  }
}

/**
 * Base class for defining all {@linkcode Ability} Attributes post summon
 * @see {@linkcode applyPostSummon()}
 */
export class PostSummonAbAttr extends AbAttr {
  /**
   * Applies ability post summon (after switching in)
   * @param pokemon {@linkcode Pokemon} with this ability
   * @param passive Whether this ability is a passive
   * @param args Set of unique arguments needed by this attribute
   * @returns true if application of the ability succeeds
   */
  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}
/**
 * Removes specified arena tags when a Pokemon is summoned.
 */
export class PostSummonRemoveArenaTagAbAttr extends PostSummonAbAttr {
  private arenaTags: ArenaTagType[];

  /**
   * @param arenaTags {@linkcode ArenaTagType[]} - the arena tags to be removed
   */
  constructor(arenaTags: ArenaTagType[]) {
    super(true);

    this.arenaTags = arenaTags;
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    for (const arenaTag of this.arenaTags) {
      pokemon.scene.arena.removeTag(arenaTag);
    }
    return true;
  }
}

export class PostSummonMessageAbAttr extends PostSummonAbAttr {
  private messageFunc: (pokemon: Pokemon) => string;

  constructor(messageFunc: (pokemon: Pokemon) => string) {
    super(true);

    this.messageFunc = messageFunc;
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    pokemon.scene.queueMessage(this.messageFunc(pokemon));

    return true;
  }
}

export class PostSummonUnnamedMessageAbAttr extends PostSummonAbAttr {
  //Attr doesn't force pokemon name on the message
  private message: string;

  constructor(message: string) {
    super(true);

    this.message = message;
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    pokemon.scene.queueMessage(this.message);

    return true;
  }
}

export class PostSummonAddBattlerTagAbAttr extends PostSummonAbAttr {
  private tagType: BattlerTagType;
  private turnCount: integer;

  constructor(tagType: BattlerTagType, turnCount: integer, showAbility?: boolean) {
    super(showAbility);

    this.tagType = tagType;
    this.turnCount = turnCount;
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    return pokemon.addTag(this.tagType, this.turnCount);
  }
}

export class PostSummonStatChangeAbAttr extends PostSummonAbAttr {
  private stats: BattleStat[];
  private levels: integer;
  private selfTarget: boolean;
  private intimidate: boolean;

  constructor(stats: BattleStat | BattleStat[], levels: integer, selfTarget?: boolean, intimidate?: boolean) {
    super(false);

    this.stats = typeof(stats) === "number"
      ? [ stats as BattleStat ]
      : stats as BattleStat[];
    this.levels = levels;
    this.selfTarget = !!selfTarget;
    this.intimidate = !!intimidate;
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    queueShowAbility(pokemon, passive);  // TODO: Better solution than manually showing the ability here
    if (this.selfTarget) {
      // we unshift the StatChangePhase to put it right after the showAbility and not at the end of the
      // phase list (which could be after CommandPhase for example)
      pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, this.stats, this.levels));
      return true;
    }
    for (const opponent of pokemon.getOpponents()) {
      const cancelled = new Utils.BooleanHolder(false);
      if (this.intimidate) {
        applyAbAttrs(IntimidateImmunityAbAttr, opponent, cancelled);
        applyAbAttrs(PostIntimidateStatChangeAbAttr, opponent, cancelled);
      }
      if (!cancelled.value) {
        const statChangePhase = new StatChangePhase(pokemon.scene, opponent.getBattlerIndex(), false, this.stats, this.levels);
        pokemon.scene.unshiftPhase(statChangePhase);
      }
    }
    return true;
  }
}

export class PostSummonAllyHealAbAttr extends PostSummonAbAttr {
  private healRatio: number;
  private showAnim: boolean;

  constructor(healRatio: number, showAnim: boolean = false) {
    super();

    this.healRatio = healRatio || 4;
    this.showAnim = showAnim;
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const target = pokemon.getAlly();
    if (target?.isActive(true)) {
      target.scene.unshiftPhase(new PokemonHealPhase(target.scene, target.getBattlerIndex(),
        Math.max(Math.floor(pokemon.getMaxHp() / this.healRatio), 1), i18next.t("abilityTriggers:postSummonAllyHeal", { pokemonNameWithAffix: getPokemonNameWithAffix(target), pokemonName: pokemon.name }), true, !this.showAnim));
      return true;
    }

    return false;
  }
}

/**
 * Resets an ally's temporary stat boots to zero with no regard to
 * whether this is a positive or negative change
 * @param pokemon The {@link Pokemon} with this {@link AbAttr}
 * @param passive N/A
 * @param args N/A
 * @returns if the move was successful
 */
export class PostSummonClearAllyStatsAbAttr extends PostSummonAbAttr {
  constructor() {
    super();
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const target = pokemon.getAlly();
    if (target?.isActive(true)) {
      for (let s = 0; s < target.summonData.battleStats.length; s++) {
        target.summonData.battleStats[s] = 0;
      }

      target.scene.queueMessage(i18next.t("abilityTriggers:postSummonClearAllyStats", { pokemonNameWithAffix: getPokemonNameWithAffix(target) }));

      return true;
    }

    return false;
  }
}

/**
 * Download raises either the Attack stat or Special Attack stat by one stage depending on the foe's currently lowest defensive stat:
 * it will raise Attack if the foe's current Defense is lower than its current Special Defense stat;
 * otherwise, it will raise Special Attack.
 * @extends PostSummonAbAttr
 * @see {applyPostSummon}
 */
export class DownloadAbAttr extends PostSummonAbAttr {
  private enemyDef: integer;
  private enemySpDef: integer;
  private enemyCountTally: integer;
  private stats: BattleStat[];

  // TODO: Implement the Substitute feature(s) once move is implemented.
  /**
   * Checks to see if it is the opening turn (starting a new game), if so, Download won't work. This is because Download takes into account
   * vitamins and items, so it needs to use the BattleStat and the stat alone.
   * @param {Pokemon} pokemon Pokemon that is using the move, as well as seeing the opposing pokemon.
   * @param {boolean} passive N/A
   * @param {any[]} args N/A
   * @returns Returns true if ability is used successful, false if not.
   */
  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    this.enemyDef = 0;
    this.enemySpDef = 0;
    this.enemyCountTally = 0;

    for (const opponent of pokemon.getOpponents()) {
      this.enemyCountTally++;
      this.enemyDef += opponent.getBattleStat(Stat.DEF);
      this.enemySpDef += opponent.getBattleStat(Stat.SPDEF);
    }
    this.enemyDef = Math.round(this.enemyDef / this.enemyCountTally);
    this.enemySpDef = Math.round(this.enemySpDef / this.enemyCountTally);

    if (this.enemyDef < this.enemySpDef) {
      this.stats = [BattleStat.ATK];
    } else {
      this.stats = [BattleStat.SPATK];
    }

    if (this.enemyDef > 0 && this.enemySpDef > 0) { // only activate if there's actually an enemy to download from
      pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), false, this.stats, 1));
      return true;
    }

    return false;
  }
}

export class PostSummonWeatherChangeAbAttr extends PostSummonAbAttr {
  private weatherType: WeatherType;

  constructor(weatherType: WeatherType) {
    super();

    this.weatherType = weatherType;
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    if ((this.weatherType === WeatherType.HEAVY_RAIN ||
      this.weatherType === WeatherType.HARSH_SUN ||
      this.weatherType === WeatherType.STRONG_WINDS) || !pokemon.scene.arena.weather?.isImmutable()) {
      return pokemon.scene.arena.trySetWeather(this.weatherType, true);
    }

    return false;
  }
}

export class PostSummonTerrainChangeAbAttr extends PostSummonAbAttr {
  private terrainType: TerrainType;

  constructor(terrainType: TerrainType) {
    super();

    this.terrainType = terrainType;
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    return pokemon.scene.arena.trySetTerrain(this.terrainType, true);
  }
}

export class PostSummonFormChangeAbAttr extends PostSummonAbAttr {
  private formFunc: (p: Pokemon) => integer;

  constructor(formFunc: ((p: Pokemon) => integer)) {
    super(true);

    this.formFunc = formFunc;
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const formIndex = this.formFunc(pokemon);
    if (formIndex !== pokemon.formIndex) {
      return pokemon.scene.triggerPokemonFormChange(pokemon, SpeciesFormChangeManualTrigger, false);
    }

    return false;
  }
}

/** Attempts to copy a pokemon's ability */
export class PostSummonCopyAbilityAbAttr extends PostSummonAbAttr {
  private target: Pokemon;
  private targetAbilityName: string;

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const targets = pokemon.getOpponents();
    if (!targets.length) {
      return false;
    }

    let target: Pokemon;
    if (targets.length > 1) {
      pokemon.scene.executeWithSeedOffset(() => target = Utils.randSeedItem(targets), pokemon.scene.currentBattle.waveIndex);
    } else {
      target = targets[0];
    }

    if (
      target.getAbility().hasAttr(UncopiableAbilityAbAttr) &&
      // Wonder Guard is normally uncopiable so has the attribute, but Trace specifically can copy it
      !(pokemon.hasAbility(Abilities.TRACE) && target.getAbility().id === Abilities.WONDER_GUARD)
    ) {
      return false;
    }

    this.target = target;
    this.targetAbilityName = allAbilities[target.getAbility().id].name;
    pokemon.summonData.ability = target.getAbility().id;
    setAbilityRevealed(target);
    pokemon.updateInfo();

    return true;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:trace", {
      pokemonName: getPokemonNameWithAffix(pokemon),
      targetName: getPokemonNameWithAffix(this.target),
      abilityName: this.targetAbilityName,
    });
  }
}

/**
 * Removes supplied status effects from the user's field.
 */
export class PostSummonUserFieldRemoveStatusEffectAbAttr extends PostSummonAbAttr {
  private statusEffect: StatusEffect[];

  /**
   * @param statusEffect - The status effects to be removed from the user's field.
   */
  constructor(...statusEffect: StatusEffect[]) {
    super(false);

    this.statusEffect = statusEffect;
  }

  /**
   * Removes supplied status effect from the user's field when user of the ability is summoned.
   *
   * @param pokemon - The Pokémon that triggered the ability.
   * @param passive - n/a
   * @param args - n/a
   * @returns A boolean or a promise that resolves to a boolean indicating the result of the ability application.
   */
  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    const party = pokemon instanceof PlayerPokemon ? pokemon.scene.getPlayerField() : pokemon.scene.getEnemyField();
    const allowedParty = party.filter(p => p.isAllowedInBattle());

    if (allowedParty.length < 1) {
      return false;
    }

    for (const pokemon of allowedParty) {
      if (this.statusEffect.includes(pokemon.status?.effect)) {
        pokemon.scene.queueMessage(getStatusEffectHealText(pokemon.status.effect, getPokemonNameWithAffix(pokemon)));
        pokemon.resetStatus(false);
        pokemon.updateInfo();
      }
    }

    return true;
  }
}


/** Attempt to copy the stat changes on an ally pokemon */
export class PostSummonCopyAllyStatsAbAttr extends PostSummonAbAttr {
  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    if (!pokemon.scene.currentBattle.double) {
      return false;
    }

    const ally = pokemon.getAlly();
    if (!ally || ally.summonData.battleStats.every((change) => change === 0)) {
      return false;
    }

    pokemon.summonData.battleStats = ally.summonData.battleStats;
    pokemon.updateInfo();

    return true;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:costar", {
      pokemonName: getPokemonNameWithAffix(pokemon),
      allyName: getPokemonNameWithAffix(pokemon.getAlly()),
    });
  }
}

export class PostSummonTransformAbAttr extends PostSummonAbAttr {
  constructor() {
    super(true);
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const targets = pokemon.getOpponents();
    if (!targets.length) {
      return false;
    }

    let target: Pokemon;
    if (targets.length > 1) {
      pokemon.scene.executeWithSeedOffset(() => target = Utils.randSeedItem(targets), pokemon.scene.currentBattle.waveIndex);
    } else {
      target = targets[0];
    }

    pokemon.summonData.speciesForm = target.getSpeciesForm();
    pokemon.summonData.fusionSpeciesForm = target.getFusionSpeciesForm();
    pokemon.summonData.ability = target.getAbility().id;
    pokemon.summonData.gender = target.getGender();
    pokemon.summonData.fusionGender = target.getFusionGender();
    pokemon.summonData.stats = [ pokemon.stats[Stat.HP] ].concat(target.stats.slice(1));
    pokemon.summonData.battleStats = target.summonData.battleStats.slice(0);
    pokemon.summonData.moveset = target.getMoveset().map(m => new PokemonMove(m.moveId, m.ppUsed, m.ppUp));
    pokemon.summonData.types = target.getTypes();

    pokemon.scene.playSound("PRSFX- Transform");

    pokemon.loadAssets(false).then(() => pokemon.playAnim());

    pokemon.scene.queueMessage(i18next.t("abilityTriggers:postSummonTransform", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), targetName: target.name, }));

    return true;
  }
}

export class PreSwitchOutAbAttr extends AbAttr {
  constructor() {
    super(true);
  }

  applyPreSwitchOut(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

export class PreSwitchOutResetStatusAbAttr extends PreSwitchOutAbAttr {
  applyPreSwitchOut(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    if (pokemon.status) {
      pokemon.resetStatus();
      pokemon.updateInfo();
      return true;
    }

    return false;
  }
}

/**
 * Clears Desolate Land/Primordial Sea/Delta Stream upon the Pokemon switching out.
 */
export class PreSwitchOutClearWeatherAbAttr extends PreSwitchOutAbAttr {

  /**
   * @param pokemon The {@linkcode Pokemon} with the ability
   * @param passive N/A
   * @param args N/A
   * @returns {boolean} Returns true if the weather clears, otherwise false.
   */
  applyPreSwitchOut(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    const weatherType = pokemon.scene.arena.weather.weatherType;
    let turnOffWeather = false;

    // Clear weather only if user's ability matches the weather and no other pokemon has the ability.
    switch (weatherType) {
    case (WeatherType.HARSH_SUN):
      if (pokemon.hasAbility(Abilities.DESOLATE_LAND)
          && pokemon.scene.getField(true).filter(p => p !== pokemon).filter(p => p.hasAbility(Abilities.DESOLATE_LAND)).length === 0) {
        turnOffWeather = true;
      }
      break;
    case (WeatherType.HEAVY_RAIN):
      if (pokemon.hasAbility(Abilities.PRIMORDIAL_SEA)
          && pokemon.scene.getField(true).filter(p => p !== pokemon).filter(p => p.hasAbility(Abilities.PRIMORDIAL_SEA)).length === 0) {
        turnOffWeather = true;
      }
      break;
    case (WeatherType.STRONG_WINDS):
      if (pokemon.hasAbility(Abilities.DELTA_STREAM)
          && pokemon.scene.getField(true).filter(p => p !== pokemon).filter(p => p.hasAbility(Abilities.DELTA_STREAM)).length === 0) {
        turnOffWeather = true;
      }
      break;
    }

    if (turnOffWeather) {
      pokemon.scene.arena.trySetWeather(WeatherType.NONE, false);
      return true;
    }

    return false;
  }
}

export class PreSwitchOutHealAbAttr extends PreSwitchOutAbAttr {
  applyPreSwitchOut(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    if (!pokemon.isFullHp()) {
      const healAmount = Math.floor(pokemon.getMaxHp() * 0.33);
      pokemon.heal(healAmount);
      pokemon.updateInfo();
      return true;
    }

    return false;
  }
}

/**
 * Attribute for form changes that occur on switching out
 * @extends PreSwitchOutAbAttr
 * @see {@linkcode applyPreSwitchOut}
 */
export class PreSwitchOutFormChangeAbAttr extends PreSwitchOutAbAttr {
  private formFunc: (p: Pokemon) => integer;

  constructor(formFunc: ((p: Pokemon) => integer)) {
    super();

    this.formFunc = formFunc;
  }

  /**
   * On switch out, trigger the form change to the one defined in the ability
   * @param pokemon The pokemon switching out and changing form {@linkcode Pokemon}
   * @param passive N/A
   * @param args N/A
   * @returns true if the form change was successful
   */
  applyPreSwitchOut(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    const formIndex = this.formFunc(pokemon);
    if (formIndex !== pokemon.formIndex) {
      pokemon.scene.triggerPokemonFormChange(pokemon, SpeciesFormChangeManualTrigger, false);
      return true;
    }

    return false;
  }

}

export class PreStatChangeAbAttr extends AbAttr {
  applyPreStatChange(pokemon: Pokemon, passive: boolean, stat: BattleStat, cancelled: Utils.BooleanHolder, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

export class ProtectStatAbAttr extends PreStatChangeAbAttr {
  private protectedStat: BattleStat;

  constructor(protectedStat?: BattleStat) {
    super();

    this.protectedStat = protectedStat;
  }

  applyPreStatChange(pokemon: Pokemon, passive: boolean, stat: BattleStat, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.protectedStat === undefined || stat === this.protectedStat) {
      cancelled.value = true;
      return true;
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:protectStat", {
      pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
      abilityName,
      statName: this.protectedStat !== undefined ? getBattleStatName(this.protectedStat) : i18next.t("battle:stats")
    });
  }
}

/**
 * This attribute applies confusion to the target whenever the user
 * directly poisons them with a move, e.g. Poison Puppeteer.
 * Called in {@linkcode StatusEffectAttr}.
 * @extends PostAttackAbAttr
 * @see {@linkcode applyPostAttack}
 */
export class ConfusionOnStatusEffectAbAttr extends PostAttackAbAttr {
  /** List of effects to apply confusion after */
  private effects: StatusEffect[];

  constructor(...effects: StatusEffect[]) {
    /** This effect does not require a damaging move */
    super((user, target, move) => true);
    this.effects = effects;
  }
  /**
   * Applies confusion to the target pokemon.
   * @param pokemon {@link Pokemon} attacking
   * @param passive N/A
   * @param defender {@link Pokemon} defending
   * @param move {@link Move} used to apply status effect and confusion
   * @param hitResult N/A
   * @param args [0] {@linkcode StatusEffect} applied by move
   * @returns true if defender is confused
   */
  applyPostAttackAfterMoveTypeCheck(pokemon: Pokemon, passive: boolean, defender: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (this.effects.indexOf(args[0]) > -1 && !defender.isFainted()) {
      return defender.addTag(BattlerTagType.CONFUSED, pokemon.randSeedInt(3,2), move.id, defender.id);
    }
    return false;
  }
}

export class PreSetStatusAbAttr extends AbAttr {
  applyPreSetStatus(pokemon: Pokemon, passive: boolean, effect: StatusEffect, cancelled: Utils.BooleanHolder, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

/**
 * Provides immunity to status effects to specified targets.
 */
export class PreSetStatusEffectImmunityAbAttr extends PreSetStatusAbAttr {
  private immuneEffects: StatusEffect[];

  /**
   * @param immuneEffects - The status effects to which the Pokémon is immune.
   */
  constructor(...immuneEffects: StatusEffect[]) {
    super();

    this.immuneEffects = immuneEffects;
  }

  /**
   * Applies immunity to supplied status effects.
   *
   * @param pokemon - The Pokémon to which the status is being applied.
   * @param passive - n/a
   * @param effect - The status effect being applied.
   * @param cancelled - A holder for a boolean value indicating if the status application was cancelled.
   * @param args - n/a
   * @returns A boolean indicating the result of the status application.
   */
  applyPreSetStatus(pokemon: Pokemon, passive: boolean, effect: StatusEffect, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.immuneEffects.length < 1 || this.immuneEffects.includes(effect)) {
      cancelled.value = true;
      return true;
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return this.immuneEffects.length ?
      i18next.t("abilityTriggers:statusEffectImmunityWithName", {
        pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
        abilityName,
        statusEffectName: getStatusEffectDescriptor(args[0] as StatusEffect)
      }) :
      i18next.t("abilityTriggers:statusEffectImmunity", {
        pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
        abilityName
      });
  }
}

/**
 * Provides immunity to status effects to the user.
 * @extends PreSetStatusEffectImmunityAbAttr
 */
export class StatusEffectImmunityAbAttr extends PreSetStatusEffectImmunityAbAttr { }

/**
 * Provides immunity to status effects to the user's field.
 * @extends PreSetStatusEffectImmunityAbAttr
 */
export class UserFieldStatusEffectImmunityAbAttr extends PreSetStatusEffectImmunityAbAttr { }

export class PreApplyBattlerTagAbAttr extends AbAttr {
  applyPreApplyBattlerTag(pokemon: Pokemon, passive: boolean, tag: BattlerTag, cancelled: Utils.BooleanHolder, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

/**
 * Provides immunity to BattlerTags {@linkcode BattlerTag} to specified targets.
 */
export class PreApplyBattlerTagImmunityAbAttr extends PreApplyBattlerTagAbAttr {
  private immuneTagType: BattlerTagType;
  private battlerTag: BattlerTag;

  constructor(immuneTagType: BattlerTagType) {
    super();

    this.immuneTagType = immuneTagType;
  }

  applyPreApplyBattlerTag(pokemon: Pokemon, passive: boolean, tag: BattlerTag, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (tag.tagType === this.immuneTagType) {
      cancelled.value = true;
      this.battlerTag = tag;
      return true;
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:battlerTagImmunity", {
      pokemonNameWithAffix: getPokemonNameWithAffix(pokemon),
      abilityName,
      battlerTagName: this.battlerTag.getDescriptor()
    });
  }
}

/**
 * Provides immunity to BattlerTags {@linkcode BattlerTag} to the user.
 * @extends PreApplyBattlerTagImmunityAbAttr
 */
export class BattlerTagImmunityAbAttr extends PreApplyBattlerTagImmunityAbAttr { }

/**
 * Provides immunity to BattlerTags {@linkcode BattlerTag} to the user's field.
 * @extends PreApplyBattlerTagImmunityAbAttr
 */
export class UserFieldBattlerTagImmunityAbAttr extends PreApplyBattlerTagImmunityAbAttr { }

export class BlockCritAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    (args[0] as Utils.BooleanHolder).value = true;
    return true;
  }
}

export class BonusCritAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    (args[0] as Utils.BooleanHolder).value = true;
    return true;
  }
}

export class MultCritAbAttr extends AbAttr {
  public multAmount: number;

  constructor(multAmount: number) {
    super(true);

    this.multAmount = multAmount;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const critMult = args[0] as Utils.NumberHolder;
    if (critMult.value > 1) {
      critMult.value *= this.multAmount;
      return true;
    }

    return false;
  }
}

/**
 * Guarantees a critical hit according to the given condition, except if target prevents critical hits. ie. Merciless
 * @extends AbAttr
 * @see {@linkcode apply}
 */
export class ConditionalCritAbAttr extends AbAttr {
  private condition: PokemonAttackCondition;

  constructor(condition: PokemonAttackCondition, checkUser?: Boolean) {
    super();

    this.condition = condition;
  }

  /**
   * @param pokemon {@linkcode Pokemon} user.
   * @param args [0] {@linkcode Utils.BooleanHolder} If true critical hit is guaranteed.
   *             [1] {@linkcode Pokemon} Target.
   *             [2] {@linkcode Move} used by ability user.
   */
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const target = (args[1] as Pokemon);
    const move = (args[2] as Move);
    if (!this.condition(pokemon,target,move)) {
      return false;
    }

    (args[0] as Utils.BooleanHolder).value = true;
    return true;
  }
}

export class BlockNonDirectDamageAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    cancelled.value = true;
    return true;
  }
}

/**
 * This attribute will block any status damage that you put in the parameter.
 */
export class BlockStatusDamageAbAttr extends AbAttr {
  private effects: StatusEffect[];

  /**
   * @param {StatusEffect[]} effects The status effect(s) that will be blocked from damaging the ability pokemon
   */
  constructor(...effects: StatusEffect[]) {
    super(false);

    this.effects = effects;
  }

  /**
   * @param {Pokemon} pokemon The pokemon with the ability
   * @param {boolean} passive N/A
   * @param {Utils.BooleanHolder} cancelled Whether to cancel the status damage
   * @param {any[]} args N/A
   * @returns Returns true if status damage is blocked
   */
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.effects.includes(pokemon.status?.effect)) {
      cancelled.value = true;
      return true;
    }
    return false;
  }
}

export class BlockOneHitKOAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    cancelled.value = true;
    return true;
  }
}

export class IncrementMovePriorityAbAttr extends AbAttr {
  private moveIncrementFunc: (pokemon: Pokemon, move: Move) => boolean;
  private increaseAmount: integer;

  constructor(moveIncrementFunc: (pokemon: Pokemon, move: Move) => boolean, increaseAmount = 1) {
    super(true);

    this.moveIncrementFunc = moveIncrementFunc;
    this.increaseAmount = increaseAmount;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (!this.moveIncrementFunc(pokemon, args[0] as Move)) {
      return false;
    }

    (args[1] as Utils.IntegerHolder).value += this.increaseAmount;
    return true;
  }
}

export class IgnoreContactAbAttr extends AbAttr { }

export class PreWeatherEffectAbAttr extends AbAttr {
  applyPreWeatherEffect(pokemon: Pokemon, passive: boolean, weather: Weather, cancelled: Utils.BooleanHolder, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

export class PreWeatherDamageAbAttr extends PreWeatherEffectAbAttr { }

export class BlockWeatherDamageAttr extends PreWeatherDamageAbAttr {
  private weatherTypes: WeatherType[];

  constructor(...weatherTypes: WeatherType[]) {
    super();

    this.weatherTypes = weatherTypes;
  }

  applyPreWeatherEffect(pokemon: Pokemon, passive: boolean, weather: Weather, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (!this.weatherTypes.length || this.weatherTypes.indexOf(weather?.weatherType) > -1) {
      cancelled.value = true;
    }

    return true;
  }
}

export class SuppressWeatherEffectAbAttr extends PreWeatherEffectAbAttr {
  public affectsImmutable: boolean;

  constructor(affectsImmutable?: boolean) {
    super();

    this.affectsImmutable = affectsImmutable;
  }

  applyPreWeatherEffect(pokemon: Pokemon, passive: boolean, weather: Weather, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.affectsImmutable || weather.isImmutable()) {
      cancelled.value = true;
      return true;
    }

    return false;
  }
}

/**
 * Condition function to applied to abilities related to Sheer Force.
 * Checks if last move used against target was affected by a Sheer Force user and:
 * Disables: Color Change, Pickpocket, Wimp Out, Emergency Exit, Berserk, Anger Shell
 * @returns {AbAttrCondition} If false disables the ability which the condition is applied to.
 */
function getSheerForceHitDisableAbCondition(): AbAttrCondition {
  return (pokemon: Pokemon) => {
    if (!pokemon.turnData) {
      return true;
    }

    const lastReceivedAttack = pokemon.turnData.attacksReceived[0];
    if (!lastReceivedAttack) {
      return true;
    }

    const lastAttacker = pokemon.getOpponents().find(p => p.id === lastReceivedAttack.sourceId);
    if (!lastAttacker) {
      return true;
    }

    /**if the last move chance is greater than or equal to cero, and the last attacker's ability is sheer force*/
    const SheerForceAffected = allMoves[lastReceivedAttack.move].chance >= 0 && lastAttacker.hasAbility(Abilities.SHEER_FORCE);

    return !SheerForceAffected;
  };
}

function getWeatherCondition(...weatherTypes: WeatherType[]): AbAttrCondition {
  return (pokemon: Pokemon) => {
    if (!pokemon.scene?.arena) {
      return false;
    }
    if (pokemon.scene.arena.weather?.isEffectSuppressed(pokemon.scene)) {
      return false;
    }
    const weatherType = pokemon.scene.arena.weather?.weatherType;
    return weatherType && weatherTypes.indexOf(weatherType) > -1;
  };
}

function getAnticipationCondition(): AbAttrCondition {
  return (pokemon: Pokemon) => {
    for (const opponent of pokemon.getOpponents()) {
      for (const move of opponent.moveset) {
        // move is super effective
        if (move.getMove() instanceof AttackMove && pokemon.getAttackTypeEffectiveness(move.getMove().type, opponent, true) >= 2) {
          return true;
        }
        // move is a OHKO
        if (move.getMove().hasAttr(OneHitKOAttr)) {
          return true;
        }
        // edge case for hidden power, type is computed
        if (move.getMove().id === Moves.HIDDEN_POWER) {
          const iv_val = Math.floor(((opponent.ivs[Stat.HP] & 1)
              +(opponent.ivs[Stat.ATK] & 1) * 2
              +(opponent.ivs[Stat.DEF] & 1) * 4
              +(opponent.ivs[Stat.SPD] & 1) * 8
              +(opponent.ivs[Stat.SPATK] & 1) * 16
              +(opponent.ivs[Stat.SPDEF] & 1) * 32) * 15/63);

          const type = [
            Type.FIGHTING, Type.FLYING, Type.POISON, Type.GROUND,
            Type.ROCK, Type.BUG, Type.GHOST, Type.STEEL,
            Type.FIRE, Type.WATER, Type.GRASS, Type.ELECTRIC,
            Type.PSYCHIC, Type.ICE, Type.DRAGON, Type.DARK][iv_val];

          if (pokemon.getAttackTypeEffectiveness(type, opponent) >= 2) {
            return true;
          }
        }
      }
    }
    return false;
  };
}

/**
 * Creates an ability condition that causes the ability to fail if that ability
 * has already been used by that pokemon that battle. It requires an ability to
 * be specified due to current limitations in how conditions on abilities work.
 * @param {Abilities} ability The ability to check if it's already been applied
 * @returns {AbAttrCondition} The condition
 */
function getOncePerBattleCondition(ability: Abilities): AbAttrCondition {
  return (pokemon: Pokemon) => {
    return !pokemon.battleData?.abilitiesApplied.includes(ability);
  };
}

export class ForewarnAbAttr extends PostSummonAbAttr {
  constructor() {
    super(true);
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    let maxPowerSeen = 0;
    let maxMove = "";
    let movePower = 0;
    for (const opponent of pokemon.getOpponents()) {
      for (const move of opponent.moveset) {
        if (move.getMove() instanceof StatusMove) {
          movePower = 1;
        } else if (move.getMove().hasAttr(OneHitKOAttr)) {
          movePower = 150;
        } else if (move.getMove().id === Moves.COUNTER || move.getMove().id === Moves.MIRROR_COAT || move.getMove().id === Moves.METAL_BURST) {
          movePower = 120;
        } else if (move.getMove().power === -1) {
          movePower = 80;
        } else {
          movePower = move.getMove().power;
        }

        if (movePower > maxPowerSeen) {
          maxPowerSeen = movePower;
          maxMove = move.getName();
        }
      }
    }
    pokemon.scene.queueMessage(i18next.t("abilityTriggers:forewarn", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), moveName: maxMove }));
    return true;
  }
}

export class FriskAbAttr extends PostSummonAbAttr {
  constructor() {
    super(true);
  }

  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    for (const opponent of pokemon.getOpponents()) {
      pokemon.scene.queueMessage(i18next.t("abilityTriggers:frisk", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), opponentName: opponent.name, opponentAbilityName: opponent.getAbility().name }));
      setAbilityRevealed(opponent);
    }
    return true;
  }
}

export class PostWeatherChangeAbAttr extends AbAttr {
  applyPostWeatherChange(pokemon: Pokemon, passive: boolean, weather: WeatherType, args: any[]): boolean {
    return false;
  }
}

export class PostWeatherChangeAddBattlerTagAttr extends PostWeatherChangeAbAttr {
  private tagType: BattlerTagType;
  private turnCount: integer;
  private weatherTypes: WeatherType[];

  constructor(tagType: BattlerTagType, turnCount: integer, ...weatherTypes: WeatherType[]) {
    super();

    this.tagType = tagType;
    this.turnCount = turnCount;
    this.weatherTypes = weatherTypes;
  }

  applyPostWeatherChange(pokemon: Pokemon, passive: boolean, weather: WeatherType, args: any[]): boolean {
    console.log(this.weatherTypes.find(w => weather === w), WeatherType[weather]);
    if (!this.weatherTypes.find(w => weather === w)) {
      return false;
    }

    return pokemon.addTag(this.tagType, this.turnCount);
  }
}

export class PostWeatherLapseAbAttr extends AbAttr {
  protected weatherTypes: WeatherType[];

  constructor(...weatherTypes: WeatherType[]) {
    super();

    this.weatherTypes = weatherTypes;
  }

  applyPostWeatherLapse(pokemon: Pokemon, passive: boolean, weather: Weather, args: any[]): boolean | Promise<boolean> {
    return false;
  }

  getCondition(): AbAttrCondition {
    return getWeatherCondition(...this.weatherTypes);
  }
}

export class PostWeatherLapseHealAbAttr extends PostWeatherLapseAbAttr {
  private healFactor: integer;

  constructor(healFactor: integer, ...weatherTypes: WeatherType[]) {
    super(...weatherTypes);

    this.healFactor = healFactor;
  }

  applyPostWeatherLapse(pokemon: Pokemon, passive: boolean, weather: Weather, args: any[]): boolean {
    if (!pokemon.isFullHp()) {
      const scene = pokemon.scene;
      const abilityName = (!passive ? pokemon.getAbility() : pokemon.getPassiveAbility()).name;
      scene.unshiftPhase(new PokemonHealPhase(scene, pokemon.getBattlerIndex(),
        Math.max(Math.floor(pokemon.getMaxHp() / (16 / this.healFactor)), 1), i18next.t("abilityTriggers:postWeatherLapseHeal", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), abilityName }), true));
      return true;
    }

    return false;
  }
}

export class PostWeatherLapseDamageAbAttr extends PostWeatherLapseAbAttr {
  private damageFactor: integer;

  constructor(damageFactor: integer, ...weatherTypes: WeatherType[]) {
    super(...weatherTypes);

    this.damageFactor = damageFactor;
  }

  applyPostWeatherLapse(pokemon: Pokemon, passive: boolean, weather: Weather, args: any[]): boolean {
    const scene = pokemon.scene;
    if (pokemon.hasAbilityWithAttr(BlockNonDirectDamageAbAttr)) {
      return false;
    }
    const abilityName = (!passive ? pokemon.getAbility() : pokemon.getPassiveAbility()).name;
    scene.queueMessage(i18next.t("abilityTriggers:postWeatherLapseDamage", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), abilityName }));
    pokemon.damageAndUpdate(Math.ceil(pokemon.getMaxHp() / (16 / this.damageFactor)), HitResult.OTHER);
    return true;
  }
}

export class PostTerrainChangeAbAttr extends AbAttr {
  applyPostTerrainChange(pokemon: Pokemon, passive: boolean, terrain: TerrainType, args: any[]): boolean {
    return false;
  }
}

export class PostTerrainChangeAddBattlerTagAttr extends PostTerrainChangeAbAttr {
  private tagType: BattlerTagType;
  private turnCount: integer;
  private terrainTypes: TerrainType[];

  constructor(tagType: BattlerTagType, turnCount: integer, ...terrainTypes: TerrainType[]) {
    super();

    this.tagType = tagType;
    this.turnCount = turnCount;
    this.terrainTypes = terrainTypes;
  }

  applyPostTerrainChange(pokemon: Pokemon, passive: boolean, terrain: TerrainType, args: any[]): boolean {
    if (!this.terrainTypes.find(t => t === terrain)) {
      return false;
    }

    return pokemon.addTag(this.tagType, this.turnCount);
  }
}

function getTerrainCondition(...terrainTypes: TerrainType[]): AbAttrCondition {
  return (pokemon: Pokemon) => {
    const terrainType = pokemon.scene.arena.terrain?.terrainType;
    return terrainType && terrainTypes.indexOf(terrainType) > -1;
  };
}

export class PostTurnAbAttr extends AbAttr {
  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

/**
 * This attribute will heal 1/8th HP if the ability pokemon has the correct status.
 */
export class PostTurnStatusHealAbAttr extends PostTurnAbAttr {
  private effects: StatusEffect[];

  /**
   * @param {StatusEffect[]} effects The status effect(s) that will qualify healing the ability pokemon
   */
  constructor(...effects: StatusEffect[]) {
    super(false);

    this.effects = effects;
  }

  /**
   * @param {Pokemon} pokemon The pokemon with the ability that will receive the healing
   * @param {Boolean} passive N/A
   * @param {any[]} args N/A
   * @returns Returns true if healed from status, false if not
   */
  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    if (this.effects.includes(pokemon.status?.effect)) {
      if (!pokemon.isFullHp()) {
        const scene = pokemon.scene;
        const abilityName = (!passive ? pokemon.getAbility() : pokemon.getPassiveAbility()).name;
        scene.unshiftPhase(new PokemonHealPhase(scene, pokemon.getBattlerIndex(),
          Math.max(Math.floor(pokemon.getMaxHp() / 8), 1), i18next.t("abilityTriggers:poisonHeal", { pokemonName: getPokemonNameWithAffix(pokemon), abilityName }), true));
        return true;
      }
    }
    return false;
  }
}

/**
 * After the turn ends, resets the status of either the ability holder or their ally
 * @param {boolean} allyTarget Whether to target ally, defaults to false (self-target)
 */
export class PostTurnResetStatusAbAttr extends PostTurnAbAttr {
  private allyTarget: boolean;
  private target: Pokemon;

  constructor(allyTarget: boolean = false) {
    super(true);
    this.allyTarget = allyTarget;
  }

  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    if (this.allyTarget) {
      this.target = pokemon.getAlly();
    } else {
      this.target = pokemon;
    }
    if (this.target?.status) {

      this.target.scene.queueMessage(getStatusEffectHealText(this.target.status?.effect, getPokemonNameWithAffix(this.target)));
      this.target.resetStatus(false);
      this.target.updateInfo();
      return true;
    }

    return false;
  }
}

/**
 * After the turn ends, try to create an extra item
 */
export class PostTurnLootAbAttr extends PostTurnAbAttr {
  /**
   * @param itemType - The type of item to create
   * @param procChance - Chance to create an item
   * @see {@linkcode applyPostTurn()}
   */
  constructor(
    /** Extend itemType to add more options */
    private itemType: "EATEN_BERRIES" | "HELD_BERRIES",
    private procChance: (pokemon: Pokemon) => number
  ) {
    super();
  }

  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const pass = Phaser.Math.RND.realInRange(0, 1);
    // Clamp procChance to [0, 1]. Skip if didn't proc (less than pass)
    if (Math.max(Math.min(this.procChance(pokemon), 1), 0) < pass) {
      return false;
    }

    if (this.itemType === "EATEN_BERRIES") {
      return this.createEatenBerry(pokemon);
    } else {
      return false;
    }
  }

  /**
   * Create a new berry chosen randomly from the berries the pokemon ate this battle
   * @param pokemon The pokemon with this ability
   * @returns whether a new berry was created
   */
  createEatenBerry(pokemon: Pokemon): boolean {
    const berriesEaten = pokemon.battleData.berriesEaten;

    if (!berriesEaten.length) {
      return false;
    }

    const randomIdx = Utils.randSeedInt(berriesEaten.length);
    const chosenBerryType = berriesEaten[randomIdx];
    const chosenBerry = new BerryModifierType(chosenBerryType);
    berriesEaten.splice(randomIdx); // Remove berry from memory

    const berryModifier = pokemon.scene.findModifier(
      (m) => m instanceof BerryModifier && m.berryType === chosenBerryType,
      pokemon.isPlayer()
    ) as BerryModifier | undefined;

    if (!berryModifier) {
      const newBerry = new BerryModifier(chosenBerry, pokemon.id, chosenBerryType, 1);
      if (pokemon.isPlayer()) {
        pokemon.scene.addModifier(newBerry);
      } else {
        pokemon.scene.addEnemyModifier(newBerry);
      }
    } else if (berryModifier.stackCount < berryModifier.getMaxHeldItemCount(pokemon)) {
      berryModifier.stackCount++;
    }

    pokemon.scene.queueMessage(i18next.t("abilityTriggers:postTurnLootCreateEatenBerry", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), berryName: chosenBerry.name }));
    pokemon.scene.updateModifiers(pokemon.isPlayer());

    return true;
  }
}

export class MoodyAbAttr extends PostTurnAbAttr {
  constructor() {
    super(true);
  }

  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const selectableStats = [BattleStat.ATK, BattleStat.DEF, BattleStat.SPATK, BattleStat.SPDEF, BattleStat.SPD];
    const increaseStatArray = selectableStats.filter(s => pokemon.summonData.battleStats[s] < 6);
    let decreaseStatArray = selectableStats.filter(s => pokemon.summonData.battleStats[s] > -6);

    if (increaseStatArray.length > 0) {
      const increaseStat = increaseStatArray[Utils.randInt(increaseStatArray.length)];
      decreaseStatArray = decreaseStatArray.filter(s => s !== increaseStat);
      pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, [increaseStat], 2));
    }
    if (decreaseStatArray.length > 0) {
      const decreaseStat = selectableStats[Utils.randInt(selectableStats.length)];
      pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, [decreaseStat], -1));
    }
    return true;
  }
}

export class PostTurnStatChangeAbAttr extends PostTurnAbAttr {
  private stats: BattleStat[];
  private levels: integer;

  constructor(stats: BattleStat | BattleStat[], levels: integer) {
    super(true);

    this.stats = Array.isArray(stats)
      ? stats
      : [ stats ];
    this.levels = levels;
  }

  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, this.stats, this.levels));
    return true;
  }
}

export class PostTurnHealAbAttr extends PostTurnAbAttr {
  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    if (!pokemon.isFullHp()) {
      const scene = pokemon.scene;
      const abilityName = (!passive ? pokemon.getAbility() : pokemon.getPassiveAbility()).name;
      scene.unshiftPhase(new PokemonHealPhase(scene, pokemon.getBattlerIndex(),
        Math.max(Math.floor(pokemon.getMaxHp() / 16), 1), i18next.t("abilityTriggers:postTurnHeal", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), abilityName }), true));
      return true;
    }

    return false;
  }
}

export class PostTurnFormChangeAbAttr extends PostTurnAbAttr {
  private formFunc: (p: Pokemon) => integer;

  constructor(formFunc: ((p: Pokemon) => integer)) {
    super(true);

    this.formFunc = formFunc;
  }

  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const formIndex = this.formFunc(pokemon);
    if (formIndex !== pokemon.formIndex) {
      pokemon.scene.triggerPokemonFormChange(pokemon, SpeciesFormChangeManualTrigger, false);
      return true;
    }

    return false;
  }
}


/**
 * Attribute used for abilities (Bad Dreams) that damages the opponents for being asleep
 */
export class PostTurnHurtIfSleepingAbAttr extends PostTurnAbAttr {

  /**
   * Deals damage to all sleeping opponents equal to 1/8 of their max hp (min 1)
   * @param {Pokemon} pokemon Pokemon that has this ability
   * @param {boolean} passive N/A
   * @param {any[]} args N/A
   * @returns {boolean} true if any opponents are sleeping
   */
  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean | Promise<boolean> {
    let hadEffect: boolean = false;
    for (const opp of pokemon.getOpponents()) {
      if ((opp.status?.effect === StatusEffect.SLEEP || opp.hasAbility(Abilities.COMATOSE)) && !opp.hasAbilityWithAttr(BlockNonDirectDamageAbAttr)) {
        opp.damageAndUpdate(Math.floor(Math.max(1, opp.getMaxHp() / 8)), HitResult.OTHER);
        pokemon.scene.queueMessage(i18next.t("abilityTriggers:badDreams", {pokemonName: getPokemonNameWithAffix(opp)}));
        hadEffect = true;
      }

    }
    return hadEffect;
  }
}


/**
 * Grabs the last failed Pokeball used
 * @extends PostTurnAbAttr
 * @see {@linkcode applyPostTurn} */
export class FetchBallAbAttr extends PostTurnAbAttr {
  constructor() {
    super();
  }
  /**
   * Adds the last used Pokeball back into the player's inventory
   * @param pokemon {@linkcode Pokemon} with this ability
   * @param passive N/A
   * @param args N/A
   * @returns true if player has used a pokeball and this pokemon is owned by the player
   */
  applyPostTurn(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const lastUsed = pokemon.scene.currentBattle.lastUsedPokeball;
    if (lastUsed !== null && pokemon.isPlayer) {
      pokemon.scene.pokeballCounts[lastUsed]++;
      pokemon.scene.currentBattle.lastUsedPokeball = null;
      pokemon.scene.queueMessage(i18next.t("abilityTriggers:fetchBall", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), pokeballName: getPokeballName(lastUsed) }));
      return true;
    }
    return false;
  }
}

export class PostBiomeChangeAbAttr extends AbAttr { }

export class PostBiomeChangeWeatherChangeAbAttr extends PostBiomeChangeAbAttr {
  private weatherType: WeatherType;

  constructor(weatherType: WeatherType) {
    super();

    this.weatherType = weatherType;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (!pokemon.scene.arena.weather?.isImmutable()) {
      return pokemon.scene.arena.trySetWeather(this.weatherType, true);
    }

    return false;
  }
}

export class PostBiomeChangeTerrainChangeAbAttr extends PostBiomeChangeAbAttr {
  private terrainType: TerrainType;

  constructor(terrainType: TerrainType) {
    super();

    this.terrainType = terrainType;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    return pokemon.scene.arena.trySetTerrain(this.terrainType, true);
  }
}

/**
 * Triggers just after a move is used either by the opponent or the player
 * @extends AbAttr
 */
export class PostMoveUsedAbAttr extends AbAttr {
  applyPostMoveUsed(pokemon: Pokemon, move: PokemonMove, source: Pokemon, targets: BattlerIndex[], args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

/**
 * Triggers after a dance move is used either by the opponent or the player
 * @extends PostMoveUsedAbAttr
 */
export class PostDancingMoveAbAttr extends PostMoveUsedAbAttr {
  /**
   * Resolves the Dancer ability by replicating the move used by the source of the dance
   * either on the source itself or on the target of the dance
   * @param dancer {@linkcode Pokemon} with Dancer ability
   * @param move {@linkcode PokemonMove} Dancing move used by the source
   * @param source {@linkcode Pokemon} that used the dancing move
   * @param targets {@linkcode BattlerIndex}Targets of the dancing move
   * @param args N/A
   *
   * @return true if the Dancer ability was resolved
   */
  applyPostMoveUsed(dancer: Pokemon, move: PokemonMove, source: Pokemon, targets: BattlerIndex[], args: any[]): boolean | Promise<boolean> {
    // List of tags that prevent the Dancer from replicating the move
    const forbiddenTags = [BattlerTagType.FLYING, BattlerTagType.UNDERWATER,
      BattlerTagType.UNDERGROUND, BattlerTagType.HIDDEN];
    // The move to replicate cannot come from the Dancer
    if (source.getBattlerIndex() !== dancer.getBattlerIndex()
        && !dancer.summonData.tags.some(tag => forbiddenTags.includes(tag.tagType))) {
      // If the move is an AttackMove or a StatusMove the Dancer must replicate the move on the source of the Dance
      if (move.getMove() instanceof AttackMove || move.getMove() instanceof StatusMove) {
        const target = this.getTarget(dancer, source, targets);
        dancer.scene.unshiftPhase(new MovePhase(dancer.scene, dancer, target, move, true));
      } else if (move.getMove() instanceof SelfStatusMove) {
        // If the move is a SelfStatusMove (ie. Swords Dance) the Dancer should replicate it on itself
        dancer.scene.unshiftPhase(new MovePhase(dancer.scene, dancer, [dancer.getBattlerIndex()], move, true));
      }
      return true;
    }
    return false;
  }

  /**
   * Get the correct targets of Dancer ability
   *
   * @param dancer {@linkcode Pokemon} Pokemon with Dancer ability
   * @param source {@linkcode Pokemon} Source of the dancing move
   * @param targets {@linkcode BattlerIndex} Targets of the dancing move
   */
  getTarget(dancer: Pokemon, source: Pokemon, targets: BattlerIndex[]) : BattlerIndex[] {
    if (dancer.isPlayer()) {
      return source.isPlayer() ? targets : [source.getBattlerIndex()];
    }
    return source.isPlayer() ? [source.getBattlerIndex()] : targets;
  }
}

export class StatChangeMultiplierAbAttr extends AbAttr {
  private multiplier: integer;

  constructor(multiplier: integer) {
    super(true);

    this.multiplier = multiplier;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    (args[0] as Utils.IntegerHolder).value *= this.multiplier;

    return true;
  }
}

export class StatChangeCopyAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean | Promise<boolean> {
    pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, (args[0] as BattleStat[]), (args[1] as integer), true, false, false));
    return true;
  }
}

export class BypassBurnDamageReductionAbAttr extends AbAttr {
  constructor() {
    super(false);
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    cancelled.value = true;

    return true;
  }
}

export class DoubleBerryEffectAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    (args[0] as Utils.NumberHolder).value *= 2;

    return true;
  }
}

export class PreventBerryUseAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    cancelled.value = true;

    return true;
  }
}

/**
 * A Pokemon with this ability heals by a percentage of their maximum hp after eating a berry
 * @param healPercent - Percent of Max HP to heal
 * @see {@linkcode apply()} for implementation
 */
export class HealFromBerryUseAbAttr extends AbAttr {
  /** Percent of Max HP to heal */
  private healPercent: number;

  constructor(healPercent: number) {
    super();

    // Clamp healPercent so its between [0,1].
    this.healPercent = Math.max(Math.min(healPercent, 1), 0);
  }

  apply(pokemon: Pokemon, passive: boolean, ...args: [Utils.BooleanHolder, any[]]): boolean {
    const { name: abilityName } = passive ? pokemon.getPassiveAbility() : pokemon.getAbility();
    pokemon.scene.unshiftPhase(
      new PokemonHealPhase(
        pokemon.scene,
        pokemon.getBattlerIndex(),
        Math.max(Math.floor(pokemon.getMaxHp() * this.healPercent), 1),
        i18next.t("abilityTriggers:healFromBerryUse", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), abilityName }),
        true
      )
    );

    return true;
  }
}

export class RunSuccessAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    (args[0] as Utils.IntegerHolder).value = 256;

    return true;
  }
}

type ArenaTrapCondition = (user: Pokemon, target: Pokemon) => boolean;

/**
 * Base class for checking if a Pokemon is trapped by arena trap
 * @extends AbAttr
 * @field {@linkcode arenaTrapCondition} Conditional for trapping abilities.
 * For example, Magnet Pull will only activate if opponent is Steel type.
 * @see {@linkcode applyCheckTrapped}
 */
export class CheckTrappedAbAttr extends AbAttr {
  protected arenaTrapCondition: ArenaTrapCondition;
  constructor(condition: ArenaTrapCondition) {
    super(false);
    this.arenaTrapCondition = condition;
  }

  applyCheckTrapped(pokemon: Pokemon, passive: boolean, trapped: Utils.BooleanHolder, otherPokemon: Pokemon, args: any[]): boolean | Promise<boolean> {
    return false;
  }
}

/**
 * Determines whether a Pokemon is blocked from switching/running away
 * because of a trapping ability or move.
 * @extends CheckTrappedAbAttr
 * @see {@linkcode applyCheckTrapped}
 */
export class ArenaTrapAbAttr extends CheckTrappedAbAttr {
  /**
   * Checks if enemy Pokemon is trapped by an Arena Trap-esque ability
   * If the enemy is a Ghost type, it is not trapped
   * If the enemy has the ability Run Away, it is not trapped.
   * If the user has Magnet Pull and the enemy is not a Steel type, it is not trapped.
   * If the user has Arena Trap and the enemy is not grounded, it is not trapped.
   * @param pokemon The {@link Pokemon} with this {@link AbAttr}
   * @param passive N/A
   * @param trapped {@link Utils.BooleanHolder} indicating whether the other Pokemon is trapped or not
   * @param otherPokemon The {@link Pokemon} that is affected by an Arena Trap ability
   * @param args N/A
   * @returns if enemy Pokemon is trapped or not
   */
  applyCheckTrapped(pokemon: Pokemon, passive: boolean, trapped: Utils.BooleanHolder, otherPokemon: Pokemon, args: any[]): boolean {
    if (this.arenaTrapCondition(pokemon, otherPokemon)) {
      if (otherPokemon.getTypes(true).includes(Type.GHOST) || (otherPokemon.getTypes(true).includes(Type.STELLAR) && otherPokemon.getTypes().includes(Type.GHOST))) {
        trapped.value = false;
        return false;
      } else if (otherPokemon.hasAbility(Abilities.RUN_AWAY)) {
        trapped.value = false;
        return false;
      }
      trapped.value = true;
      return true;
    }
    trapped.value = false;
    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:arenaTrap", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), abilityName });
  }
}

export class MaxMultiHitAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    (args[0] as Utils.IntegerHolder).value = 0;

    return true;
  }
}

export class PostBattleAbAttr extends AbAttr {
  constructor() {
    super(true);
  }

  applyPostBattle(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    return false;
  }
}

export class PostBattleLootAbAttr extends PostBattleAbAttr {
  applyPostBattle(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const postBattleLoot = pokemon.scene.currentBattle.postBattleLoot;
    if (postBattleLoot.length) {
      const randItem = Utils.randSeedItem(postBattleLoot);
      if (pokemon.scene.tryTransferHeldItemModifier(randItem, pokemon, true, 1, true)) {
        postBattleLoot.splice(postBattleLoot.indexOf(randItem), 1);
        pokemon.scene.queueMessage(i18next.t("abilityTriggers:postBattleLoot", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), itemName: randItem.type.name }));
        return true;
      }
    }

    return false;
  }
}

export class PostFaintAbAttr extends AbAttr {
  applyPostFaint(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    return false;
  }
}

/**
 * Clears Desolate Land/Primordial Sea/Delta Stream upon the Pokemon fainting
 */
export class PostFaintClearWeatherAbAttr extends PostFaintAbAttr {

  /**
   * @param pokemon The {@linkcode Pokemon} with the ability
   * @param passive N/A
   * @param attacker N/A
   * @param move N/A
   * @param hitResult N/A
   * @param args N/A
   * @returns {boolean} Returns true if the weather clears, otherwise false.
   */
  applyPostFaint(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    const weatherType = pokemon.scene.arena.weather.weatherType;
    let turnOffWeather = false;

    // Clear weather only if user's ability matches the weather and no other pokemon has the ability.
    switch (weatherType) {
    case (WeatherType.HARSH_SUN):
      if (pokemon.hasAbility(Abilities.DESOLATE_LAND)
          && pokemon.scene.getField(true).filter(p => p.hasAbility(Abilities.DESOLATE_LAND)).length === 0) {
        turnOffWeather = true;
      }
      break;
    case (WeatherType.HEAVY_RAIN):
      if (pokemon.hasAbility(Abilities.PRIMORDIAL_SEA)
          && pokemon.scene.getField(true).filter(p => p.hasAbility(Abilities.PRIMORDIAL_SEA)).length === 0) {
        turnOffWeather = true;
      }
      break;
    case (WeatherType.STRONG_WINDS):
      if (pokemon.hasAbility(Abilities.DELTA_STREAM)
          && pokemon.scene.getField(true).filter(p => p.hasAbility(Abilities.DELTA_STREAM)).length === 0) {
        turnOffWeather = true;
      }
      break;
    }

    if (turnOffWeather) {
      pokemon.scene.arena.trySetWeather(WeatherType.NONE, false);
      return true;
    }

    return false;
  }
}

export class PostFaintContactDamageAbAttr extends PostFaintAbAttr {
  private damageRatio: integer;

  constructor(damageRatio: integer) {
    super();

    this.damageRatio = damageRatio;
  }

  applyPostFaint(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    if (move.checkFlag(MoveFlags.MAKES_CONTACT, attacker, pokemon)) {
      const cancelled = new Utils.BooleanHolder(false);
      pokemon.scene.getField(true).map(p=>applyAbAttrs(FieldPreventExplosiveMovesAbAttr, p, cancelled));
      if (cancelled.value || attacker.hasAbilityWithAttr(BlockNonDirectDamageAbAttr)) {
        return false;
      }
      attacker.damageAndUpdate(Math.ceil(attacker.getMaxHp() * (1 / this.damageRatio)), HitResult.OTHER);
      attacker.turnData.damageTaken += Math.ceil(attacker.getMaxHp() * (1 / this.damageRatio));
      return true;
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:postFaintContactDamage", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), abilityName });
  }
}

/**
 * Attribute used for abilities (Innards Out) that damage the opponent based on how much HP the last attack used to knock out the owner of the ability.
 */
export class PostFaintHPDamageAbAttr extends PostFaintAbAttr {
  constructor() {
    super ();
  }

  applyPostFaint(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, hitResult: HitResult, args: any[]): boolean {
    const damage = pokemon.turnData.attacksReceived[0].damage;
    attacker.damageAndUpdate((damage), HitResult.OTHER);
    attacker.turnData.damageTaken += damage;
    return true;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:postFaintHpDamage", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon), abilityName });
  }
}

export class RedirectMoveAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.canRedirect(args[0] as Moves)) {
      const target = args[1] as Utils.IntegerHolder;
      const newTarget = pokemon.getBattlerIndex();
      if (target.value !== newTarget) {
        target.value = newTarget;
        return true;
      }
    }

    return false;
  }

  canRedirect(moveId: Moves): boolean {
    const move = allMoves[moveId];
    return !![ MoveTarget.NEAR_OTHER, MoveTarget.OTHER ].find(t => move.moveTarget === t);
  }
}

export class RedirectTypeMoveAbAttr extends RedirectMoveAbAttr {
  public type: Type;

  constructor(type: Type) {
    super();
    this.type = type;
  }

  canRedirect(moveId: Moves): boolean {
    return super.canRedirect(moveId) && allMoves[moveId].type === this.type;
  }
}

export class BlockRedirectAbAttr extends AbAttr { }

export class ReduceStatusEffectDurationAbAttr extends AbAttr {
  private statusEffect: StatusEffect;

  constructor(statusEffect: StatusEffect) {
    super(true);

    this.statusEffect = statusEffect;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (args[0] === this.statusEffect) {
      (args[1] as Utils.IntegerHolder).value = Math.floor((args[1] as Utils.IntegerHolder).value / 2);
      return true;
    }

    return false;
  }
}

export class FlinchEffectAbAttr extends AbAttr {
  constructor() {
    super(true);
  }
}

export class FlinchStatChangeAbAttr extends FlinchEffectAbAttr {
  private stats: BattleStat[];
  private levels: integer;

  constructor(stats: BattleStat | BattleStat[], levels: integer) {
    super();

    this.stats = Array.isArray(stats)
      ? stats
      : [ stats ];
    this.levels = levels;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    pokemon.scene.unshiftPhase(new StatChangePhase(pokemon.scene, pokemon.getBattlerIndex(), true, this.stats, this.levels));
    return true;
  }
}

export class IncreasePpAbAttr extends AbAttr { }

export class ForceSwitchOutImmunityAbAttr extends AbAttr {
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    cancelled.value = true;
    return true;
  }
}

export class ReduceBerryUseThresholdAbAttr extends AbAttr {
  constructor() {
    super();
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const hpRatio = pokemon.getHpRatio();

    if (args[0].value < hpRatio) {
      args[0].value *= 2;
      return args[0].value >= hpRatio;
    }

    return false;
  }
}

export class WeightMultiplierAbAttr extends AbAttr {
  private multiplier: integer;

  constructor(multiplier: integer) {
    super();

    this.multiplier = multiplier;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    (args[0] as Utils.NumberHolder).value *= this.multiplier;

    return true;
  }
}

export class SyncEncounterNatureAbAttr extends AbAttr {
  constructor() {
    super(false);
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    (args[0] as Pokemon).setNature(pokemon.getNature());

    return true;
  }
}

export class MoveAbilityBypassAbAttr extends AbAttr {
  private moveIgnoreFunc: (pokemon: Pokemon, move: Move) => boolean;

  constructor(moveIgnoreFunc?: (pokemon: Pokemon, move: Move) => boolean) {
    super(false);

    this.moveIgnoreFunc = moveIgnoreFunc || ((pokemon, move) => true);
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.moveIgnoreFunc(pokemon, (args[0] as Move))) {
      cancelled.value = true;
      return true;
    }
    return false;
  }
}

export class SuppressFieldAbilitiesAbAttr extends AbAttr {
  constructor() {
    super(false);
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const ability = (args[0] as Ability);
    if (!ability.hasAttr(UnsuppressableAbilityAbAttr) && !ability.hasAttr(SuppressFieldAbilitiesAbAttr)) {
      cancelled.value = true;
      return true;
    }
    return false;
  }
}

export class AlwaysHitAbAttr extends AbAttr { }

/** Attribute for abilities that allow moves that make contact to ignore protection (i.e. Unseen Fist) */
export class IgnoreProtectOnContactAbAttr extends AbAttr { }

export class UncopiableAbilityAbAttr extends AbAttr {
  constructor() {
    super(false);
  }
}

export class UnsuppressableAbilityAbAttr extends AbAttr {
  constructor() {
    super(false);
  }
}

export class UnswappableAbilityAbAttr extends AbAttr {
  constructor() {
    super(false);
  }
}

export class NoTransformAbilityAbAttr extends AbAttr {
  constructor() {
    super(false);
  }
}

export class NoFusionAbilityAbAttr extends AbAttr {
  constructor() {
    super(false);
  }
}

export class IgnoreTypeImmunityAbAttr extends AbAttr {
  private defenderType: Type;
  private allowedMoveTypes: Type[];

  constructor(defenderType: Type, allowedMoveTypes: Type[]) {
    super(true);
    this.defenderType = defenderType;
    this.allowedMoveTypes = allowedMoveTypes;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.defenderType === (args[1] as Type) && this.allowedMoveTypes.includes(args[0] as Type)) {
      cancelled.value = true;
      return true;
    }
    return false;
  }
}

/**
 * Ignores the type immunity to Status Effects of the defender if the defender is of a certain type
 */
export class IgnoreTypeStatusEffectImmunityAbAttr extends AbAttr {
  private statusEffect: StatusEffect[];
  private defenderType: Type[];

  constructor(statusEffect: StatusEffect[], defenderType: Type[]) {
    super(true);

    this.statusEffect = statusEffect;
    this.defenderType = defenderType;
  }

  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.statusEffect.includes(args[0] as StatusEffect) && this.defenderType.includes(args[1] as Type)) {
      cancelled.value = true;
      return true;
    }

    return false;
  }
}

/**
 * Gives money to the user after the battle.
 *
 * @extends PostBattleAbAttr
 * @see {@linkcode applyPostBattle}
 */
export class MoneyAbAttr extends PostBattleAbAttr {
  constructor() {
    super();
  }

  /**
   * @param pokemon {@linkcode Pokemon} that is the user of this ability.
   * @param passive N/A
   * @param args N/A
   * @returns true
   */
  applyPostBattle(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    pokemon.scene.currentBattle.moneyScattered += pokemon.scene.getWaveMoneyAmount(0.2);
    return true;
  }
}

/**
 * Applies a stat change after a Pokémon is summoned,
 * conditioned on the presence of a specific arena tag.
 *
 * @extends {PostSummonStatChangeAbAttr}
 */
export class PostSummonStatChangeOnArenaAbAttr extends PostSummonStatChangeAbAttr {
  /**
   * The type of arena tag that conditions the stat change.
   * @private
   * @type {ArenaTagType}
   */
  private tagType: ArenaTagType;

  /**
   * Creates an instance of PostSummonStatChangeOnArenaAbAttr.
   * Initializes the stat change to increase Attack by 1 stage if the specified arena tag is present.
   *
   * @param {ArenaTagType} tagType - The type of arena tag to check for.
   */
  constructor(tagType: ArenaTagType) {
    super([BattleStat.ATK], 1, true, false);
    this.tagType = tagType;
  }

  /**
   * Applies the post-summon stat change if the specified arena tag is present on pokemon's side.
   * This is used in Wind Rider ability.
   *
   * @param {Pokemon} pokemon - The Pokémon being summoned.
   * @param {boolean} passive - Whether the effect is passive.
   * @param {any[]} args - Additional arguments.
   * @returns {boolean} - Returns true if the stat change was applied, otherwise false.
   */
  applyPostSummon(pokemon: Pokemon, passive: boolean, args: any[]): boolean {
    const side = pokemon.isPlayer() ? ArenaTagSide.PLAYER : ArenaTagSide.ENEMY;

    if (pokemon.scene.arena.getTagOnSide(this.tagType, side)) {
      return super.applyPostSummon(pokemon, passive, args);
    }
    return false;
  }
}

/**
 * Takes no damage from the first hit of a physical move.
 * This is used in Ice Face ability.
 */
export class IceFaceBlockPhysicalAbAttr extends ReceivedMoveDamageMultiplierAbAttr {
  private multiplier: number;

  constructor(condition: PokemonDefendCondition, multiplier: number) {
    super(condition, multiplier);

    this.multiplier = multiplier;
  }

  /**
   * Applies the Ice Face pre-defense ability to the Pokémon.
   * Removes BattlerTagType.ICE_FACE when hit by physical attack and is in Ice Face form.
   *
   * @param {Pokemon} pokemon - The Pokémon with the Ice Face ability.
   * @param {boolean} passive - Whether the ability is passive.
   * @param {Pokemon} attacker - The attacking Pokémon.
   * @param {PokemonMove} move - The move being used.
   * @param {Utils.BooleanHolder} cancelled - A holder for whether the move was cancelled.
   * @param {any[]} args - Additional arguments.
   * @returns {boolean} - Whether the immunity was applied.
   */
  applyPreDefend(pokemon: Pokemon, passive: boolean, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    if (this.condition(pokemon, attacker, move)) {
      (args[0] as Utils.NumberHolder).value = this.multiplier;
      pokemon.removeTag(BattlerTagType.ICE_FACE);
      return true;
    }

    return false;
  }

  /**
   * Gets the message triggered when the Pokémon avoids damage using the Ice Face ability.
   * @param {Pokemon} pokemon - The Pokémon with the Ice Face ability.
   * @param {string} abilityName - The name of the ability.
   * @param {...any} args - Additional arguments.
   * @returns {string} - The trigger message.
   */
  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:iceFaceAvoidedDamage", { pokemonName: getPokemonNameWithAffix(pokemon), abilityName });
  }
}

/**
 * If a Pokémon with this Ability selects a damaging move, it has a 30% chance of going first in its priority bracket. If the Ability activates, this is announced at the start of the turn (after move selection).
 *
 * @extends AbAttr
 */
export class BypassSpeedChanceAbAttr extends AbAttr {
  public chance: integer;

  /**
   * @param {integer} chance probability of ability being active.
   */
  constructor(chance: integer) {
    super(true);
    this.chance = chance;
  }

  /**
   * bypass move order in their priority bracket when pokemon choose damaging move
   * @param {Pokemon} pokemon {@linkcode Pokemon}  the Pokemon applying this ability
   * @param {boolean} passive N/A
   * @param {Utils.BooleanHolder} cancelled N/A
   * @param {any[]} args [0] {@linkcode Utils.BooleanHolder} set to true when the ability activated
   * @returns {boolean} - whether the ability was activated.
   */
  apply(pokemon: Pokemon, passive: boolean, cancelled: Utils.BooleanHolder, args: any[]): boolean {
    const bypassSpeed = args[0] as Utils.BooleanHolder;

    if (!bypassSpeed.value && pokemon.randSeedInt(100) < this.chance) {
      const turnCommand =
        pokemon.scene.currentBattle.turnCommands[pokemon.getBattlerIndex()];
      const isCommandFight = turnCommand?.command === Command.FIGHT;
      const move = allMoves[turnCommand.move?.move];
      const isDamageMove = move?.category === MoveCategory.PHYSICAL || move?.category === MoveCategory.SPECIAL;

      if (isCommandFight && isDamageMove) {
        bypassSpeed.value = true;
        return true;
      }
    }

    return false;
  }

  getTriggerMessage(pokemon: Pokemon, abilityName: string, ...args: any[]): string {
    return i18next.t("abilityTriggers:quickDraw", {pokemonName: getPokemonNameWithAffix(pokemon)});
  }
}

async function applyAbAttrsInternal<TAttr extends AbAttr>(
  attrType: Constructor<TAttr>,
  pokemon: Pokemon,
  applyFunc: AbAttrApplyFunc<TAttr>,
  args: any[],
  showAbilityInstant: boolean = false,
  quiet: boolean = false,
) {
  for (const passive of [false, true]) {
    if (!pokemon.canApplyAbility(passive)) {
      continue;
    }

    const ability = passive ? pokemon.getPassiveAbility() : pokemon.getAbility();
    for (const attr of ability.getAttrs(attrType)) {
      const condition = attr.getCondition();
      if (condition && !condition(pokemon)) {
        continue;
      }

      pokemon.scene.setPhaseQueueSplice();

      let result = applyFunc(attr, passive);
      // TODO Remove this when promises get reworked
      if (result instanceof Promise) {
        result = await result;
      }

      if (result) {
        if (pokemon.summonData && !pokemon.summonData.abilitiesApplied.includes(ability.id)) {
          pokemon.summonData.abilitiesApplied.push(ability.id);
        }
        if (pokemon.battleData && !pokemon.battleData.abilitiesApplied.includes(ability.id)) {
          pokemon.battleData.abilitiesApplied.push(ability.id);
        }

        if (attr.showAbility && !quiet) {
          if (showAbilityInstant) {
            pokemon.scene.abilityBar.showAbility(pokemon, passive);
          } else {
            queueShowAbility(pokemon, passive);
          }
        }

        if (!quiet) {
          const message = attr.getTriggerMessage(pokemon, ability.name, args);
          if (message) {
            pokemon.scene.queueMessage(message);
          }
        }
      }
    }

    pokemon.scene.clearPhaseQueueSplice();
  }
}

export function applyAbAttrs(attrType: Constructor<AbAttr>, pokemon: Pokemon, cancelled: Utils.BooleanHolder, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<AbAttr>(attrType, pokemon, (attr, passive) => attr.apply(pokemon, passive, cancelled, args), args);
}

export function applyPostBattleInitAbAttrs(attrType: Constructor<PostBattleInitAbAttr>,
  pokemon: Pokemon, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostBattleInitAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostBattleInit(pokemon, passive, args), args);
}

export function applyPreDefendAbAttrs(attrType: Constructor<PreDefendAbAttr>,
  pokemon: Pokemon, attacker: Pokemon, move: Move, cancelled: Utils.BooleanHolder, ...args: any[]): Promise<void> {
  const simulated = args.length > 1 && args[1];
  return applyAbAttrsInternal<PreDefendAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPreDefend(pokemon, passive, attacker, move, cancelled, args), args, false, simulated);
}

export function applyPostDefendAbAttrs(attrType: Constructor<PostDefendAbAttr>,
  pokemon: Pokemon, attacker: Pokemon, move: Move, hitResult: HitResult, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostDefendAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostDefend(pokemon, passive, attacker, move, hitResult, args), args);
}

export function applyPostMoveUsedAbAttrs(attrType: Constructor<PostMoveUsedAbAttr>,
  pokemon: Pokemon, move: PokemonMove, source: Pokemon, targets: BattlerIndex[], ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostMoveUsedAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostMoveUsed(pokemon, move, source, targets, args), args);
}

export function applyBattleStatMultiplierAbAttrs(attrType: Constructor<BattleStatMultiplierAbAttr>,
  pokemon: Pokemon, battleStat: BattleStat, statValue: Utils.NumberHolder, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<BattleStatMultiplierAbAttr>(attrType, pokemon, (attr, passive) => attr.applyBattleStat(pokemon, passive, battleStat, statValue, args), args);
}

/**
 * Applies a field Battle Stat multiplier attribute
 * @param attrType {@linkcode FieldMultiplyBattleStatAbAttr} should always be FieldMultiplyBattleStatAbAttr for the time being
 * @param pokemon {@linkcode Pokemon} the Pokemon applying this ability
 * @param stat {@linkcode Stat} the type of the checked stat
 * @param statValue {@linkcode Utils.NumberHolder} the value of the checked stat
 * @param checkedPokemon {@linkcode Pokemon} the Pokemon with the checked stat
 * @param hasApplied {@linkcode Utils.BooleanHolder} whether or not a FieldMultiplyBattleStatAbAttr has already affected this stat
 * @param args unused
 */
export function applyFieldBattleStatMultiplierAbAttrs(attrType: Constructor<FieldMultiplyBattleStatAbAttr>,
  pokemon: Pokemon, stat: Stat, statValue: Utils.NumberHolder, checkedPokemon: Pokemon, hasApplied: Utils.BooleanHolder, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<FieldMultiplyBattleStatAbAttr>(attrType, pokemon, (attr, passive) => attr.applyFieldBattleStat(pokemon, passive, stat, statValue, checkedPokemon, hasApplied, args), args);
}

export function applyPreAttackAbAttrs(attrType: Constructor<PreAttackAbAttr>,
  pokemon: Pokemon, defender: Pokemon, move: Move, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PreAttackAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPreAttack(pokemon, passive, defender, move, args), args);
}

export function applyPostAttackAbAttrs(attrType: Constructor<PostAttackAbAttr>,
  pokemon: Pokemon, defender: Pokemon, move: Move, hitResult: HitResult, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostAttackAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostAttack(pokemon, passive, defender, move, hitResult, args), args);
}

export function applyPostKnockOutAbAttrs(attrType: Constructor<PostKnockOutAbAttr>,
  pokemon: Pokemon, knockedOut: Pokemon, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostKnockOutAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostKnockOut(pokemon, passive, knockedOut, args), args);
}

export function applyPostVictoryAbAttrs(attrType: Constructor<PostVictoryAbAttr>,
  pokemon: Pokemon, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostVictoryAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostVictory(pokemon, passive, args), args);
}

export function applyPostSummonAbAttrs(attrType: Constructor<PostSummonAbAttr>,
  pokemon: Pokemon, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostSummonAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostSummon(pokemon, passive, args), args);
}

export function applyPreSwitchOutAbAttrs(attrType: Constructor<PreSwitchOutAbAttr>,
  pokemon: Pokemon, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PreSwitchOutAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPreSwitchOut(pokemon, passive, args), args, true);
}

export function applyPreStatChangeAbAttrs(attrType: Constructor<PreStatChangeAbAttr>,
  pokemon: Pokemon, stat: BattleStat, cancelled: Utils.BooleanHolder, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PreStatChangeAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPreStatChange(pokemon, passive, stat, cancelled, args), args);
}

export function applyPostStatChangeAbAttrs(attrType: Constructor<PostStatChangeAbAttr>,
  pokemon: Pokemon, stats: BattleStat[], levels: integer, selfTarget: boolean, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostStatChangeAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostStatChange(pokemon, stats, levels, selfTarget, args), args);
}

export function applyPreSetStatusAbAttrs(attrType: Constructor<PreSetStatusAbAttr>,
  pokemon: Pokemon, effect: StatusEffect, cancelled: Utils.BooleanHolder, ...args: any[]): Promise<void> {
  const simulated = args.length > 1 && args[1];
  return applyAbAttrsInternal<PreSetStatusAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPreSetStatus(pokemon, passive, effect, cancelled, args), args, false, !simulated);
}

export function applyPreApplyBattlerTagAbAttrs(attrType: Constructor<PreApplyBattlerTagAbAttr>,
  pokemon: Pokemon, tag: BattlerTag, cancelled: Utils.BooleanHolder, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PreApplyBattlerTagAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPreApplyBattlerTag(pokemon, passive, tag, cancelled, args), args);
}

export function applyPreWeatherEffectAbAttrs(attrType: Constructor<PreWeatherEffectAbAttr>,
  pokemon: Pokemon, weather: Weather, cancelled: Utils.BooleanHolder, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PreWeatherDamageAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPreWeatherEffect(pokemon, passive, weather, cancelled, args), args, true);
}

export function applyPostTurnAbAttrs(attrType: Constructor<PostTurnAbAttr>,
  pokemon: Pokemon, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostTurnAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostTurn(pokemon, passive, args), args);
}

export function applyPostWeatherChangeAbAttrs(attrType: Constructor<PostWeatherChangeAbAttr>,
  pokemon: Pokemon, weather: WeatherType, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostWeatherChangeAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostWeatherChange(pokemon, passive, weather, args), args);
}

export function applyPostWeatherLapseAbAttrs(attrType: Constructor<PostWeatherLapseAbAttr>,
  pokemon: Pokemon, weather: Weather, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostWeatherLapseAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostWeatherLapse(pokemon, passive, weather, args), args);
}

export function applyPostTerrainChangeAbAttrs(attrType: Constructor<PostTerrainChangeAbAttr>,
  pokemon: Pokemon, terrain: TerrainType, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostTerrainChangeAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostTerrainChange(pokemon, passive, terrain, args), args);
}

export function applyCheckTrappedAbAttrs(attrType: Constructor<CheckTrappedAbAttr>,
  pokemon: Pokemon, trapped: Utils.BooleanHolder, otherPokemon: Pokemon, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<CheckTrappedAbAttr>(attrType, pokemon, (attr, passive) => attr.applyCheckTrapped(pokemon, passive, trapped, otherPokemon, args), args);
}

export function applyPostBattleAbAttrs(attrType: Constructor<PostBattleAbAttr>,
  pokemon: Pokemon, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostBattleAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostBattle(pokemon, passive, args), args);
}

export function applyPostFaintAbAttrs(attrType: Constructor<PostFaintAbAttr>,
  pokemon: Pokemon, attacker: Pokemon, move: Move, hitResult: HitResult, ...args: any[]): Promise<void> {
  return applyAbAttrsInternal<PostFaintAbAttr>(attrType, pokemon, (attr, passive) => attr.applyPostFaint(pokemon, passive, attacker, move, hitResult, args), args);
}

function queueShowAbility(pokemon: Pokemon, passive: boolean): void {
  pokemon.scene.unshiftPhase(new ShowAbilityPhase(pokemon.scene, pokemon.id, passive));
  pokemon.scene.clearPhaseQueueSplice();
}

/**
 * Sets the ability of a Pokémon as revealed.
 *
 * @param pokemon - The Pokémon whose ability is being revealed.
 */
function setAbilityRevealed(pokemon: Pokemon): void {
  if (pokemon.battleData) {
    pokemon.battleData.abilityRevealed = true;
  }
}

export const allAbilities = [ new Ability(Abilities.NONE, 3) ];

export function initAbilities() {
  allAbilities.push(
    new Ability(Abilities.STENCH, 3)
      .attr(PostAttackApplyBattlerTagAbAttr, false, (user, target, move) => !move.hasAttr(FlinchAttr) ? 10 : 0, BattlerTagType.FLINCHED),
    new Ability(Abilities.DRIZZLE, 3)
      .attr(PostSummonWeatherChangeAbAttr, WeatherType.RAIN)
      .attr(PostBiomeChangeWeatherChangeAbAttr, WeatherType.RAIN),
    new Ability(Abilities.SPEED_BOOST, 3)
      .attr(PostTurnStatChangeAbAttr, BattleStat.SPD, 1),
    new Ability(Abilities.BATTLE_ARMOR, 3)
      .attr(BlockCritAbAttr)
      .ignorable(),
    new Ability(Abilities.STURDY, 3)
      .attr(PreDefendFullHpEndureAbAttr)
      .attr(BlockOneHitKOAbAttr)
      .ignorable(),
    new Ability(Abilities.DAMP, 3)
      .attr(FieldPreventExplosiveMovesAbAttr)
      .ignorable(),
    new Ability(Abilities.LIMBER, 3)
      .attr(StatusEffectImmunityAbAttr, StatusEffect.PARALYSIS)
      .ignorable(),
    new Ability(Abilities.SAND_VEIL, 3)
      .attr(BattleStatMultiplierAbAttr, BattleStat.EVA, 1.2)
      .attr(BlockWeatherDamageAttr, WeatherType.SANDSTORM)
      .condition(getWeatherCondition(WeatherType.SANDSTORM))
      .ignorable(),
    new Ability(Abilities.STATIC, 3)
      .attr(PostDefendContactApplyStatusEffectAbAttr, 30, StatusEffect.PARALYSIS)
      .bypassFaint(),
    new Ability(Abilities.VOLT_ABSORB, 3)
      .attr(TypeImmunityHealAbAttr, Type.ELECTRIC)
      .partial() // Healing not blocked by Heal Block
      .ignorable(),
    new Ability(Abilities.WATER_ABSORB, 3)
      .attr(TypeImmunityHealAbAttr, Type.WATER)
      .partial() // Healing not blocked by Heal Block
      .ignorable(),
    new Ability(Abilities.OBLIVIOUS, 3)
      .attr(BattlerTagImmunityAbAttr, BattlerTagType.INFATUATED)
      .attr(IntimidateImmunityAbAttr)
      .ignorable(),
    new Ability(Abilities.CLOUD_NINE, 3)
      .attr(SuppressWeatherEffectAbAttr, true)
      .attr(PostSummonUnnamedMessageAbAttr, "The effects of the weather disappeared."),
    new Ability(Abilities.COMPOUND_EYES, 3)
      .attr(BattleStatMultiplierAbAttr, BattleStat.ACC, 1.3),
    new Ability(Abilities.INSOMNIA, 3)
      .attr(StatusEffectImmunityAbAttr, StatusEffect.SLEEP)
      .attr(BattlerTagImmunityAbAttr, BattlerTagType.DROWSY)
      .ignorable(),
    new Ability(Abilities.COLOR_CHANGE, 3)
      .attr(PostDefendTypeChangeAbAttr)
      .condition(getSheerForceHitDisableAbCondition()),
    new Ability(Abilities.IMMUNITY, 3)
      .attr(StatusEffectImmunityAbAttr, StatusEffect.POISON, StatusEffect.TOXIC)
      .ignorable(),
    new Ability(Abilities.FLASH_FIRE, 3)
      .attr(TypeImmunityAddBattlerTagAbAttr, Type.FIRE, BattlerTagType.FIRE_BOOST, 1, (pokemon: Pokemon) => !pokemon.status || pokemon.status.effect !== StatusEffect.FREEZE)
      .ignorable(),
    new Ability(Abilities.SHIELD_DUST, 3)
      .attr(IgnoreMoveEffectsAbAttr)
      .partial(),
    new Ability(Abilities.OWN_TEMPO, 3)
      .attr(BattlerTagImmunityAbAttr, BattlerTagType.CONFUSED)
      .attr(IntimidateImmunityAbAttr)
      .ignorable(),
    new Ability(Abilities.SUCTION_CUPS, 3)
      .attr(ForceSwitchOutImmunityAbAttr)
      .ignorable(),
    new Ability(Abilities.INTIMIDATE, 3)
      .attr(PostSummonStatChangeAbAttr, BattleStat.ATK, -1, false, true),
    new Ability(Abilities.SHADOW_TAG, 3)
      .attr(ArenaTrapAbAttr, (user, target) => {
        if (target.hasAbility(Abilities.SHADOW_TAG)) {
          return false;
        }
        return true;
      }),
    new Ability(Abilities.ROUGH_SKIN, 3)
      .attr(PostDefendContactDamageAbAttr, 8)
      .bypassFaint(),
    new Ability(Abilities.WONDER_GUARD, 3)
      .attr(NonSuperEffectiveImmunityAbAttr)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .ignorable(),
    new Ability(Abilities.LEVITATE, 3)
      .attr(TypeImmunityAbAttr, Type.GROUND, (pokemon: Pokemon) => !pokemon.getTag(GroundedTag) && !pokemon.scene.arena.getTag(ArenaTagType.GRAVITY))
      .ignorable(),
    new Ability(Abilities.EFFECT_SPORE, 3)
      .attr(EffectSporeAbAttr),
    new Ability(Abilities.SYNCHRONIZE, 3)
      .attr(SyncEncounterNatureAbAttr)
      .unimplemented(),
    new Ability(Abilities.CLEAR_BODY, 3)
      .attr(ProtectStatAbAttr)
      .ignorable(),
    new Ability(Abilities.NATURAL_CURE, 3)
      .attr(PreSwitchOutResetStatusAbAttr),
    new Ability(Abilities.LIGHTNING_ROD, 3)
      .attr(RedirectTypeMoveAbAttr, Type.ELECTRIC)
      .attr(TypeImmunityStatChangeAbAttr, Type.ELECTRIC, BattleStat.SPATK, 1)
      .ignorable(),
    new Ability(Abilities.SERENE_GRACE, 3)
      .attr(MoveEffectChanceMultiplierAbAttr, 2)
      .partial(),
    new Ability(Abilities.SWIFT_SWIM, 3)
      .attr(BattleStatMultiplierAbAttr, BattleStat.SPD, 2)
      .condition(getWeatherCondition(WeatherType.RAIN, WeatherType.HEAVY_RAIN)),
    new Ability(Abilities.CHLOROPHYLL, 3)
      .attr(BattleStatMultiplierAbAttr, BattleStat.SPD, 2)
      .condition(getWeatherCondition(WeatherType.SUNNY, WeatherType.HARSH_SUN)),
    new Ability(Abilities.ILLUMINATE, 3)
      .attr(ProtectStatAbAttr, BattleStat.ACC)
      .attr(DoubleBattleChanceAbAttr)
      .ignorable(),
    new Ability(Abilities.TRACE, 3)
      .attr(PostSummonCopyAbilityAbAttr)
      .attr(UncopiableAbilityAbAttr),
    new Ability(Abilities.HUGE_POWER, 3)
      .attr(BattleStatMultiplierAbAttr, BattleStat.ATK, 2),
    new Ability(Abilities.POISON_POINT, 3)
      .attr(PostDefendContactApplyStatusEffectAbAttr, 30, StatusEffect.POISON)
      .bypassFaint(),
    new Ability(Abilities.INNER_FOCUS, 3)
      .attr(BattlerTagImmunityAbAttr, BattlerTagType.FLINCHED)
      .attr(IntimidateImmunityAbAttr)
      .ignorable(),
    new Ability(Abilities.MAGMA_ARMOR, 3)
      .attr(StatusEffectImmunityAbAttr, StatusEffect.FREEZE)
      .ignorable(),
    new Ability(Abilities.WATER_VEIL, 3)
      .attr(StatusEffectImmunityAbAttr, StatusEffect.BURN)
      .ignorable(),
    new Ability(Abilities.MAGNET_PULL, 3)
      .attr(ArenaTrapAbAttr, (user, target) => {
        if (target.getTypes(true).includes(Type.STEEL) || (target.getTypes(true).includes(Type.STELLAR) && target.getTypes().includes(Type.STEEL))) {
          return true;
        }
        return false;
      }),
    new Ability(Abilities.SOUNDPROOF, 3)
      .attr(MoveImmunityAbAttr, (pokemon, attacker, move) => pokemon !== attacker && move.hasFlag(MoveFlags.SOUND_BASED))
      .ignorable(),
    new Ability(Abilities.RAIN_DISH, 3)
      .attr(PostWeatherLapseHealAbAttr, 1, WeatherType.RAIN, WeatherType.HEAVY_RAIN)
      .partial(), // Healing not blocked by Heal Block
    new Ability(Abilities.SAND_STREAM, 3)
      .attr(PostSummonWeatherChangeAbAttr, WeatherType.SANDSTORM)
      .attr(PostBiomeChangeWeatherChangeAbAttr, WeatherType.SANDSTORM),
    new Ability(Abilities.PRESSURE, 3)
      .attr(IncreasePpAbAttr)
      .attr(PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonPressure", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) })),
    new Ability(Abilities.THICK_FAT, 3)
      .attr(ReceivedTypeDamageMultiplierAbAttr, Type.FIRE, 0.5)
      .attr(ReceivedTypeDamageMultiplierAbAttr, Type.ICE, 0.5)
      .ignorable(),
    new Ability(Abilities.EARLY_BIRD, 3)
      .attr(ReduceStatusEffectDurationAbAttr, StatusEffect.SLEEP),
    new Ability(Abilities.FLAME_BODY, 3)
      .attr(PostDefendContactApplyStatusEffectAbAttr, 30, StatusEffect.BURN)
      .bypassFaint(),
    new Ability(Abilities.RUN_AWAY, 3)
      .attr(RunSuccessAbAttr),
    new Ability(Abilities.KEEN_EYE, 3)
      .attr(ProtectStatAbAttr, BattleStat.ACC)
      .ignorable(),
    new Ability(Abilities.HYPER_CUTTER, 3)
      .attr(ProtectStatAbAttr, BattleStat.ATK)
      .ignorable(),
    new Ability(Abilities.PICKUP, 3)
      .attr(PostBattleLootAbAttr),
    new Ability(Abilities.TRUANT, 3)
      .attr(PostSummonAddBattlerTagAbAttr, BattlerTagType.TRUANT, 1, false),
    new Ability(Abilities.HUSTLE, 3)
      .attr(BattleStatMultiplierAbAttr, BattleStat.ATK, 1.5)
      .attr(BattleStatMultiplierAbAttr, BattleStat.ACC, 0.8, (user, target, move) => move.category === MoveCategory.PHYSICAL),
    new Ability(Abilities.CUTE_CHARM, 3)
      .attr(PostDefendContactApplyTagChanceAbAttr, 30, BattlerTagType.INFATUATED),
    new Ability(Abilities.PLUS, 3)
      .conditionalAttr(p => p.scene.currentBattle.double && [Abilities.PLUS, Abilities.MINUS].some(a => p.getAlly().hasAbility(a)), BattleStatMultiplierAbAttr, BattleStat.SPATK, 1.5)
      .ignorable(),
    new Ability(Abilities.MINUS, 3)
      .conditionalAttr(p => p.scene.currentBattle.double && [Abilities.PLUS, Abilities.MINUS].some(a => p.getAlly().hasAbility(a)), BattleStatMultiplierAbAttr, BattleStat.SPATK, 1.5)
      .ignorable(),
    new Ability(Abilities.FORECAST, 3)
      .attr(UncopiableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .unimplemented(),
    new Ability(Abilities.STICKY_HOLD, 3)
      .attr(BlockItemTheftAbAttr)
      .bypassFaint()
      .ignorable(),
    new Ability(Abilities.SHED_SKIN, 3)
      .conditionalAttr(pokemon => !Utils.randSeedInt(3), PostTurnResetStatusAbAttr),
    new Ability(Abilities.GUTS, 3)
      .attr(BypassBurnDamageReductionAbAttr)
      .conditionalAttr(pokemon => !!pokemon.status || pokemon.hasAbility(Abilities.COMATOSE), BattleStatMultiplierAbAttr, BattleStat.ATK, 1.5),
    new Ability(Abilities.MARVEL_SCALE, 3)
      .conditionalAttr(pokemon => !!pokemon.status || pokemon.hasAbility(Abilities.COMATOSE), BattleStatMultiplierAbAttr, BattleStat.DEF, 1.5)
      .ignorable(),
    new Ability(Abilities.LIQUID_OOZE, 3)
      .attr(ReverseDrainAbAttr),
    new Ability(Abilities.OVERGROW, 3)
      .attr(LowHpMoveTypePowerBoostAbAttr, Type.GRASS),
    new Ability(Abilities.BLAZE, 3)
      .attr(LowHpMoveTypePowerBoostAbAttr, Type.FIRE),
    new Ability(Abilities.TORRENT, 3)
      .attr(LowHpMoveTypePowerBoostAbAttr, Type.WATER),
    new Ability(Abilities.SWARM, 3)
      .attr(LowHpMoveTypePowerBoostAbAttr, Type.BUG),
    new Ability(Abilities.ROCK_HEAD, 3)
      .attr(BlockRecoilDamageAttr),
    new Ability(Abilities.DROUGHT, 3)
      .attr(PostSummonWeatherChangeAbAttr, WeatherType.SUNNY)
      .attr(PostBiomeChangeWeatherChangeAbAttr, WeatherType.SUNNY),
    new Ability(Abilities.ARENA_TRAP, 3)
      .attr(ArenaTrapAbAttr, (user, target) => {
        if (target.isGrounded()) {
          return true;
        }
        return false;
      })
      .attr(DoubleBattleChanceAbAttr),
    new Ability(Abilities.VITAL_SPIRIT, 3)
      .attr(StatusEffectImmunityAbAttr, StatusEffect.SLEEP)
      .attr(BattlerTagImmunityAbAttr, BattlerTagType.DROWSY)
      .ignorable(),
    new Ability(Abilities.WHITE_SMOKE, 3)
      .attr(ProtectStatAbAttr)
      .ignorable(),
    new Ability(Abilities.PURE_POWER, 3)
      .attr(BattleStatMultiplierAbAttr, BattleStat.ATK, 2),
    new Ability(Abilities.SHELL_ARMOR, 3)
      .attr(BlockCritAbAttr)
      .ignorable(),
    new Ability(Abilities.AIR_LOCK, 3)
      .attr(SuppressWeatherEffectAbAttr, true)
      .attr(PostSummonUnnamedMessageAbAttr, "The effects of the weather disappeared."),
    new Ability(Abilities.TANGLED_FEET, 4)
      .conditionalAttr(pokemon => !!pokemon.getTag(BattlerTagType.CONFUSED), BattleStatMultiplierAbAttr, BattleStat.EVA, 2)
      .ignorable(),
    new Ability(Abilities.MOTOR_DRIVE, 4)
      .attr(TypeImmunityStatChangeAbAttr, Type.ELECTRIC, BattleStat.SPD, 1)
      .ignorable(),
    new Ability(Abilities.RIVALRY, 4)
      .attr(MovePowerBoostAbAttr, (user, target, move) => user.gender !== Gender.GENDERLESS && target.gender !== Gender.GENDERLESS && user.gender === target.gender, 1.25, true)
      .attr(MovePowerBoostAbAttr, (user, target, move) => user.gender !== Gender.GENDERLESS && target.gender !== Gender.GENDERLESS && user.gender !== target.gender, 0.75),
    new Ability(Abilities.STEADFAST, 4)
      .attr(FlinchStatChangeAbAttr, BattleStat.SPD, 1),
    new Ability(Abilities.SNOW_CLOAK, 4)
      .attr(BattleStatMultiplierAbAttr, BattleStat.EVA, 1.2)
      .attr(BlockWeatherDamageAttr, WeatherType.HAIL)
      .condition(getWeatherCondition(WeatherType.HAIL, WeatherType.SNOW))
      .ignorable(),
    new Ability(Abilities.GLUTTONY, 4)
      .attr(ReduceBerryUseThresholdAbAttr),
    new Ability(Abilities.ANGER_POINT, 4)
      .attr(PostDefendCritStatChangeAbAttr, BattleStat.ATK, 6),
    new Ability(Abilities.UNBURDEN, 4)
      .unimplemented(),
    new Ability(Abilities.HEATPROOF, 4)
      .attr(ReceivedTypeDamageMultiplierAbAttr, Type.FIRE, 0.5)
      .ignorable(),
    new Ability(Abilities.SIMPLE, 4)
      .attr(StatChangeMultiplierAbAttr, 2)
      .ignorable(),
    new Ability(Abilities.DRY_SKIN, 4)
      .attr(PostWeatherLapseDamageAbAttr, 2, WeatherType.SUNNY, WeatherType.HARSH_SUN)
      .attr(PostWeatherLapseHealAbAttr, 2, WeatherType.RAIN, WeatherType.HEAVY_RAIN)
      .attr(ReceivedTypeDamageMultiplierAbAttr, Type.FIRE, 1.25)
      .attr(TypeImmunityHealAbAttr, Type.WATER)
      .partial() // Healing not blocked by Heal Block
      .ignorable(),
    new Ability(Abilities.DOWNLOAD, 4)
      .attr(DownloadAbAttr),
    new Ability(Abilities.IRON_FIST, 4)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.hasFlag(MoveFlags.PUNCHING_MOVE), 1.2),
    new Ability(Abilities.POISON_HEAL, 4)
      .attr(PostTurnStatusHealAbAttr, StatusEffect.TOXIC, StatusEffect.POISON)
      .attr(BlockStatusDamageAbAttr, StatusEffect.TOXIC, StatusEffect.POISON),
    new Ability(Abilities.ADAPTABILITY, 4)
      .attr(StabBoostAbAttr),
    new Ability(Abilities.SKILL_LINK, 4)
      .attr(MaxMultiHitAbAttr),
    new Ability(Abilities.HYDRATION, 4)
      .attr(PostTurnResetStatusAbAttr)
      .condition(getWeatherCondition(WeatherType.RAIN, WeatherType.HEAVY_RAIN)),
    new Ability(Abilities.SOLAR_POWER, 4)
      .attr(PostWeatherLapseDamageAbAttr, 2, WeatherType.SUNNY, WeatherType.HARSH_SUN)
      .attr(BattleStatMultiplierAbAttr, BattleStat.SPATK, 1.5)
      .condition(getWeatherCondition(WeatherType.SUNNY, WeatherType.HARSH_SUN)),
    new Ability(Abilities.QUICK_FEET, 4)
      .conditionalAttr(pokemon => pokemon.status ? pokemon.status.effect === StatusEffect.PARALYSIS : false, BattleStatMultiplierAbAttr, BattleStat.SPD, 2)
      .conditionalAttr(pokemon => !!pokemon.status || pokemon.hasAbility(Abilities.COMATOSE), BattleStatMultiplierAbAttr, BattleStat.SPD, 1.5),
    new Ability(Abilities.NORMALIZE, 4)
      .attr(MoveTypeChangeAttr, Type.NORMAL, 1.2, (user, target, move) => {
        return ![Moves.HIDDEN_POWER, Moves.WEATHER_BALL, Moves.NATURAL_GIFT, Moves.JUDGMENT, Moves.TECHNO_BLAST].includes(move.id);
      }),
    new Ability(Abilities.SNIPER, 4)
      .attr(MultCritAbAttr, 1.5),
    new Ability(Abilities.MAGIC_GUARD, 4)
      .attr(BlockNonDirectDamageAbAttr),
    new Ability(Abilities.NO_GUARD, 4)
      .attr(AlwaysHitAbAttr)
      .attr(DoubleBattleChanceAbAttr),
    new Ability(Abilities.STALL, 4)
      .unimplemented(),
    new Ability(Abilities.TECHNICIAN, 4)
      .attr(MovePowerBoostAbAttr, (user, target, move) => {
        const power = new Utils.NumberHolder(move.power);
        applyMoveAttrs(VariablePowerAttr, user, target, move, power);
        return power.value <= 60;
      }, 1.5),
    new Ability(Abilities.LEAF_GUARD, 4)
      .attr(StatusEffectImmunityAbAttr)
      .condition(getWeatherCondition(WeatherType.SUNNY, WeatherType.HARSH_SUN))
      .ignorable(),
    new Ability(Abilities.KLUTZ, 4)
      .unimplemented(),
    new Ability(Abilities.MOLD_BREAKER, 4)
      .attr(PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonMoldBreaker", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }))
      .attr(MoveAbilityBypassAbAttr),
    new Ability(Abilities.SUPER_LUCK, 4)
      .attr(BonusCritAbAttr)
      .partial(),
    new Ability(Abilities.AFTERMATH, 4)
      .attr(PostFaintContactDamageAbAttr,4)
      .bypassFaint(),
    new Ability(Abilities.ANTICIPATION, 4)
      .conditionalAttr(getAnticipationCondition(), PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonAnticipation", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) })),
    new Ability(Abilities.FOREWARN, 4)
      .attr(ForewarnAbAttr),
    new Ability(Abilities.UNAWARE, 4)
      .attr(IgnoreOpponentStatChangesAbAttr)
      .ignorable(),
    new Ability(Abilities.TINTED_LENS, 4)
      .attr(DamageBoostAbAttr, 2, (user, target, move) => target.getAttackTypeEffectiveness(move.type, user) <= 0.5),
    new Ability(Abilities.FILTER, 4)
      .attr(ReceivedMoveDamageMultiplierAbAttr,(target, user, move) => target.getAttackTypeEffectiveness(move.type, user) >= 2, 0.75)
      .ignorable(),
    new Ability(Abilities.SLOW_START, 4)
      .attr(PostSummonAddBattlerTagAbAttr, BattlerTagType.SLOW_START, 5),
    new Ability(Abilities.SCRAPPY, 4)
      .attr(IgnoreTypeImmunityAbAttr, Type.GHOST, [Type.NORMAL, Type.FIGHTING])
      .attr(IntimidateImmunityAbAttr),
    new Ability(Abilities.STORM_DRAIN, 4)
      .attr(RedirectTypeMoveAbAttr, Type.WATER)
      .attr(TypeImmunityStatChangeAbAttr, Type.WATER, BattleStat.SPATK, 1)
      .ignorable(),
    new Ability(Abilities.ICE_BODY, 4)
      .attr(BlockWeatherDamageAttr, WeatherType.HAIL)
      .attr(PostWeatherLapseHealAbAttr, 1, WeatherType.HAIL, WeatherType.SNOW)
      .partial(), // Healing not blocked by Heal Block
    new Ability(Abilities.SOLID_ROCK, 4)
      .attr(ReceivedMoveDamageMultiplierAbAttr,(target, user, move) => target.getAttackTypeEffectiveness(move.type, user) >= 2, 0.75)
      .ignorable(),
    new Ability(Abilities.SNOW_WARNING, 4)
      .attr(PostSummonWeatherChangeAbAttr, WeatherType.SNOW)
      .attr(PostBiomeChangeWeatherChangeAbAttr, WeatherType.SNOW),
    new Ability(Abilities.HONEY_GATHER, 4)
      .attr(MoneyAbAttr),
    new Ability(Abilities.FRISK, 4)
      .attr(FriskAbAttr),
    new Ability(Abilities.RECKLESS, 4)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.hasFlag(MoveFlags.RECKLESS_MOVE), 1.2),
    new Ability(Abilities.MULTITYPE, 4)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr),
    new Ability(Abilities.FLOWER_GIFT, 4)
      .conditionalAttr(getWeatherCondition(WeatherType.SUNNY || WeatherType.HARSH_SUN), BattleStatMultiplierAbAttr, BattleStat.ATK, 1.5)
      .conditionalAttr(getWeatherCondition(WeatherType.SUNNY || WeatherType.HARSH_SUN), BattleStatMultiplierAbAttr, BattleStat.SPDEF, 1.5)
      .attr(UncopiableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .ignorable()
      .partial(),
    new Ability(Abilities.BAD_DREAMS, 4)
      .attr(PostTurnHurtIfSleepingAbAttr),
    new Ability(Abilities.PICKPOCKET, 5)
      .attr(PostDefendStealHeldItemAbAttr, (target, user, move) => move.hasFlag(MoveFlags.MAKES_CONTACT))
      .condition(getSheerForceHitDisableAbCondition()),
    new Ability(Abilities.SHEER_FORCE, 5)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.chance >= 1, 5461/4096)
      .attr(MoveEffectChanceMultiplierAbAttr, 0)
      .partial(),
    new Ability(Abilities.CONTRARY, 5)
      .attr(StatChangeMultiplierAbAttr, -1)
      .ignorable(),
    new Ability(Abilities.UNNERVE, 5)
      .attr(PreventBerryUseAbAttr),
    new Ability(Abilities.DEFIANT, 5)
      .attr(PostStatChangeStatChangeAbAttr, (target, statsChanged, levels) => levels < 0, [BattleStat.ATK], 2),
    new Ability(Abilities.DEFEATIST, 5)
      .attr(BattleStatMultiplierAbAttr, BattleStat.ATK, 0.5)
      .attr(BattleStatMultiplierAbAttr, BattleStat.SPATK, 0.5)
      .condition((pokemon) => pokemon.getHpRatio() <= 0.5),
    new Ability(Abilities.CURSED_BODY, 5)
      .attr(PostDefendMoveDisableAbAttr, 30)
      .bypassFaint(),
    new Ability(Abilities.HEALER, 5)
      .conditionalAttr(pokemon => pokemon.getAlly() && Utils.randSeedInt(10) < 3, PostTurnResetStatusAbAttr, true),
    new Ability(Abilities.FRIEND_GUARD, 5)
      .ignorable()
      .unimplemented(),
    new Ability(Abilities.WEAK_ARMOR, 5)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.category === MoveCategory.PHYSICAL, BattleStat.DEF, -1)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.category === MoveCategory.PHYSICAL, BattleStat.SPD, 2),
    new Ability(Abilities.HEAVY_METAL, 5)
      .attr(WeightMultiplierAbAttr, 2)
      .ignorable(),
    new Ability(Abilities.LIGHT_METAL, 5)
      .attr(WeightMultiplierAbAttr, 0.5)
      .ignorable(),
    new Ability(Abilities.MULTISCALE, 5)
      .attr(ReceivedMoveDamageMultiplierAbAttr,(target, user, move) => target.isFullHp(), 0.5)
      .ignorable(),
    new Ability(Abilities.TOXIC_BOOST, 5)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.category === MoveCategory.PHYSICAL && (user.status?.effect === StatusEffect.POISON || user.status?.effect === StatusEffect.TOXIC), 1.5),
    new Ability(Abilities.FLARE_BOOST, 5)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.category === MoveCategory.SPECIAL && user.status?.effect === StatusEffect.BURN, 1.5),
    new Ability(Abilities.HARVEST, 5)
      .attr(
        PostTurnLootAbAttr,
        "EATEN_BERRIES",
        /** Rate is doubled when under sun {@link https://dex.pokemonshowdown.com/abilities/harvest} */
        (pokemon) => 0.5 * (getWeatherCondition(WeatherType.SUNNY, WeatherType.HARSH_SUN)(pokemon) ? 2 : 1)
      )
      .partial(),
    new Ability(Abilities.TELEPATHY, 5)
      .attr(MoveImmunityAbAttr, (pokemon, attacker, move) => pokemon.getAlly() === attacker && move instanceof AttackMove)
      .ignorable(),
    new Ability(Abilities.MOODY, 5)
      .attr(MoodyAbAttr),
    new Ability(Abilities.OVERCOAT, 5)
      .attr(BlockWeatherDamageAttr)
      .attr(MoveImmunityAbAttr, (pokemon, attacker, move) => pokemon !== attacker && move.hasFlag(MoveFlags.POWDER_MOVE))
      .ignorable(),
    new Ability(Abilities.POISON_TOUCH, 5)
      .attr(PostAttackContactApplyStatusEffectAbAttr, 30, StatusEffect.POISON),
    new Ability(Abilities.REGENERATOR, 5)
      .attr(PreSwitchOutHealAbAttr),
    new Ability(Abilities.BIG_PECKS, 5)
      .attr(ProtectStatAbAttr, BattleStat.DEF)
      .ignorable(),
    new Ability(Abilities.SAND_RUSH, 5)
      .attr(BattleStatMultiplierAbAttr, BattleStat.SPD, 2)
      .attr(BlockWeatherDamageAttr, WeatherType.SANDSTORM)
      .condition(getWeatherCondition(WeatherType.SANDSTORM)),
    new Ability(Abilities.WONDER_SKIN, 5)
      .attr(WonderSkinAbAttr)
      .ignorable(),
    new Ability(Abilities.ANALYTIC, 5)
      .attr(MovePowerBoostAbAttr, (user, target, move) => !!target.getLastXMoves(1).find(m => m.turn === target.scene.currentBattle.turn) || user.scene.currentBattle.turnCommands[target.getBattlerIndex()].command !== Command.FIGHT, 1.3),
    new Ability(Abilities.ILLUSION, 5)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .unimplemented(),
    new Ability(Abilities.IMPOSTER, 5)
      .attr(PostSummonTransformAbAttr)
      .attr(UncopiableAbilityAbAttr),
    new Ability(Abilities.INFILTRATOR, 5)
      .unimplemented(),
    new Ability(Abilities.MUMMY, 5)
      .attr(PostDefendAbilityGiveAbAttr, Abilities.MUMMY)
      .bypassFaint(),
    new Ability(Abilities.MOXIE, 5)
      .attr(PostVictoryStatChangeAbAttr, BattleStat.ATK, 1),
    new Ability(Abilities.JUSTIFIED, 5)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.type === Type.DARK && move.category !== MoveCategory.STATUS, BattleStat.ATK, 1),
    new Ability(Abilities.RATTLED, 5)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.category !== MoveCategory.STATUS && (move.type === Type.DARK || move.type === Type.BUG ||
        move.type === Type.GHOST), BattleStat.SPD, 1)
      .attr(PostIntimidateStatChangeAbAttr, [BattleStat.SPD], 1),
    new Ability(Abilities.MAGIC_BOUNCE, 5)
      .ignorable()
      .unimplemented(),
    new Ability(Abilities.SAP_SIPPER, 5)
      .attr(TypeImmunityStatChangeAbAttr, Type.GRASS, BattleStat.ATK, 1)
      .ignorable(),
    new Ability(Abilities.PRANKSTER, 5)
      .attr(IncrementMovePriorityAbAttr, (pokemon, move: Move) => move.category === MoveCategory.STATUS),
    new Ability(Abilities.SAND_FORCE, 5)
      .attr(MoveTypePowerBoostAbAttr, Type.ROCK, 1.3)
      .attr(MoveTypePowerBoostAbAttr, Type.GROUND, 1.3)
      .attr(MoveTypePowerBoostAbAttr, Type.STEEL, 1.3)
      .attr(BlockWeatherDamageAttr, WeatherType.SANDSTORM)
      .condition(getWeatherCondition(WeatherType.SANDSTORM)),
    new Ability(Abilities.IRON_BARBS, 5)
      .attr(PostDefendContactDamageAbAttr, 8)
      .bypassFaint(),
    new Ability(Abilities.ZEN_MODE, 5)
      .attr(PostBattleInitFormChangeAbAttr, () => 0)
      .attr(PostSummonFormChangeAbAttr, p => p.getHpRatio() <= 0.5 ? 1 : 0)
      .attr(PostTurnFormChangeAbAttr, p => p.getHpRatio() <= 0.5 ? 1 : 0)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .bypassFaint(),
    new Ability(Abilities.VICTORY_STAR, 5)
      .attr(BattleStatMultiplierAbAttr, BattleStat.ACC, 1.1)
      .partial(),
    new Ability(Abilities.TURBOBLAZE, 5)
      .attr(PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonTurboblaze", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }))
      .attr(MoveAbilityBypassAbAttr),
    new Ability(Abilities.TERAVOLT, 5)
      .attr(PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonTeravolt", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }))
      .attr(MoveAbilityBypassAbAttr),
    new Ability(Abilities.AROMA_VEIL, 6)
      .ignorable()
      .unimplemented(),
    new Ability(Abilities.FLOWER_VEIL, 6)
      .ignorable()
      .unimplemented(),
    new Ability(Abilities.CHEEK_POUCH, 6)
      .attr(HealFromBerryUseAbAttr, 1/3)
      .partial(), // Healing not blocked by Heal Block
    new Ability(Abilities.PROTEAN, 6)
      .attr(PokemonTypeChangeAbAttr),
    //.condition((p) => !p.summonData?.abilitiesApplied.includes(Abilities.PROTEAN)), //Gen 9 Implementation
    new Ability(Abilities.FUR_COAT, 6)
      .attr(ReceivedMoveDamageMultiplierAbAttr, (target, user, move) => move.category === MoveCategory.PHYSICAL, 0.5)
      .ignorable(),
    new Ability(Abilities.MAGICIAN, 6)
      .attr(PostAttackStealHeldItemAbAttr),
    new Ability(Abilities.BULLETPROOF, 6)
      .attr(MoveImmunityAbAttr, (pokemon, attacker, move) => pokemon !== attacker && move.hasFlag(MoveFlags.BALLBOMB_MOVE))
      .ignorable(),
    new Ability(Abilities.COMPETITIVE, 6)
      .attr(PostStatChangeStatChangeAbAttr, (target, statsChanged, levels) => levels < 0, [BattleStat.SPATK], 2),
    new Ability(Abilities.STRONG_JAW, 6)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.hasFlag(MoveFlags.BITING_MOVE), 1.5),
    new Ability(Abilities.REFRIGERATE, 6)
      .attr(MoveTypeChangeAttr, Type.ICE, 1.2, (user, target, move) => move.type === Type.NORMAL),
    new Ability(Abilities.SWEET_VEIL, 6)
      .attr(UserFieldStatusEffectImmunityAbAttr, StatusEffect.SLEEP)
      .attr(UserFieldBattlerTagImmunityAbAttr, BattlerTagType.DROWSY)
      .ignorable()
      .partial(), // Mold Breaker ally should not be affected by Sweet Veil
    new Ability(Abilities.STANCE_CHANGE, 6)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr),
    new Ability(Abilities.GALE_WINGS, 6)
      .attr(IncrementMovePriorityAbAttr, (pokemon, move) => pokemon.isFullHp() && move.type === Type.FLYING),
    new Ability(Abilities.MEGA_LAUNCHER, 6)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.hasFlag(MoveFlags.PULSE_MOVE), 1.5),
    new Ability(Abilities.GRASS_PELT, 6)
      .conditionalAttr(getTerrainCondition(TerrainType.GRASSY), BattleStatMultiplierAbAttr, BattleStat.DEF, 1.5)
      .ignorable(),
    new Ability(Abilities.SYMBIOSIS, 6)
      .unimplemented(),
    new Ability(Abilities.TOUGH_CLAWS, 6)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.hasFlag(MoveFlags.MAKES_CONTACT), 1.3),
    new Ability(Abilities.PIXILATE, 6)
      .attr(MoveTypeChangeAttr, Type.FAIRY, 1.2, (user, target, move) => move.type === Type.NORMAL),
    new Ability(Abilities.GOOEY, 6)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.hasFlag(MoveFlags.MAKES_CONTACT), BattleStat.SPD, -1, false),
    new Ability(Abilities.AERILATE, 6)
      .attr(MoveTypeChangeAttr, Type.FLYING, 1.2, (user, target, move) => move.type === Type.NORMAL),
    new Ability(Abilities.PARENTAL_BOND, 6)
      .attr(AddSecondStrikeAbAttr, 0.25),
    new Ability(Abilities.DARK_AURA, 6)
      .attr(PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonDarkAura", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }))
      .attr(FieldMoveTypePowerBoostAbAttr, Type.DARK, 4 / 3),
    new Ability(Abilities.FAIRY_AURA, 6)
      .attr(PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonFairyAura", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }))
      .attr(FieldMoveTypePowerBoostAbAttr, Type.FAIRY, 4 / 3),
    new Ability(Abilities.AURA_BREAK, 6)
      .ignorable()
      .conditionalAttr(target => target.hasAbility(Abilities.DARK_AURA), FieldMoveTypePowerBoostAbAttr, Type.DARK, 9 / 16)
      .conditionalAttr(target => target.hasAbility(Abilities.FAIRY_AURA), FieldMoveTypePowerBoostAbAttr, Type.FAIRY, 9 / 16),
    new Ability(Abilities.PRIMORDIAL_SEA, 6)
      .attr(PostSummonWeatherChangeAbAttr, WeatherType.HEAVY_RAIN)
      .attr(PostBiomeChangeWeatherChangeAbAttr, WeatherType.HEAVY_RAIN)
      .attr(PreSwitchOutClearWeatherAbAttr)
      .attr(PostFaintClearWeatherAbAttr)
      .bypassFaint(),
    new Ability(Abilities.DESOLATE_LAND, 6)
      .attr(PostSummonWeatherChangeAbAttr, WeatherType.HARSH_SUN)
      .attr(PostBiomeChangeWeatherChangeAbAttr, WeatherType.HARSH_SUN)
      .attr(PreSwitchOutClearWeatherAbAttr)
      .attr(PostFaintClearWeatherAbAttr)
      .bypassFaint(),
    new Ability(Abilities.DELTA_STREAM, 6)
      .attr(PostSummonWeatherChangeAbAttr, WeatherType.STRONG_WINDS)
      .attr(PostBiomeChangeWeatherChangeAbAttr, WeatherType.STRONG_WINDS)
      .attr(PreSwitchOutClearWeatherAbAttr)
      .attr(PostFaintClearWeatherAbAttr)
      .bypassFaint(),
    new Ability(Abilities.STAMINA, 7)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.category !== MoveCategory.STATUS, BattleStat.DEF, 1),
    new Ability(Abilities.WIMP_OUT, 7)
      .condition(getSheerForceHitDisableAbCondition())
      .unimplemented(),
    new Ability(Abilities.EMERGENCY_EXIT, 7)
      .condition(getSheerForceHitDisableAbCondition())
      .unimplemented(),
    new Ability(Abilities.WATER_COMPACTION, 7)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.type === Type.WATER && move.category !== MoveCategory.STATUS, BattleStat.DEF, 2),
    new Ability(Abilities.MERCILESS, 7)
      .attr(ConditionalCritAbAttr, (user, target, move) => target.status?.effect === StatusEffect.TOXIC || target.status?.effect === StatusEffect.POISON),
    new Ability(Abilities.SHIELDS_DOWN, 7)
      .attr(PostBattleInitFormChangeAbAttr, () => 0)
      .attr(PostSummonFormChangeAbAttr, p => p.formIndex % 7 + (p.getHpRatio() <= 0.5 ? 7 : 0))
      .attr(PostTurnFormChangeAbAttr, p => p.formIndex % 7 + (p.getHpRatio() <= 0.5 ? 7 : 0))
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .bypassFaint()
      .partial(),
    new Ability(Abilities.STAKEOUT, 7)
      .attr(MovePowerBoostAbAttr, (user, target, move) => user.scene.currentBattle.turnCommands[target.getBattlerIndex()].command === Command.POKEMON, 2),
    new Ability(Abilities.WATER_BUBBLE, 7)
      .attr(ReceivedTypeDamageMultiplierAbAttr, Type.FIRE, 0.5)
      .attr(MoveTypePowerBoostAbAttr, Type.WATER, 2)
      .attr(StatusEffectImmunityAbAttr, StatusEffect.BURN)
      .ignorable(),
    new Ability(Abilities.STEELWORKER, 7)
      .attr(MoveTypePowerBoostAbAttr, Type.STEEL),
    new Ability(Abilities.BERSERK, 7)
      .attr(PostDefendHpGatedStatChangeAbAttr, (target, user, move) => move.category !== MoveCategory.STATUS, 0.5, [BattleStat.SPATK], 1)
      .condition(getSheerForceHitDisableAbCondition()),
    new Ability(Abilities.SLUSH_RUSH, 7)
      .attr(BattleStatMultiplierAbAttr, BattleStat.SPD, 2)
      .condition(getWeatherCondition(WeatherType.HAIL, WeatherType.SNOW)),
    new Ability(Abilities.LONG_REACH, 7)
      .attr(IgnoreContactAbAttr),
    new Ability(Abilities.LIQUID_VOICE, 7)
      .attr(MoveTypeChangeAttr, Type.WATER, 1, (user, target, move) => move.hasFlag(MoveFlags.SOUND_BASED)),
    new Ability(Abilities.TRIAGE, 7)
      .attr(IncrementMovePriorityAbAttr, (pokemon, move) => move.hasFlag(MoveFlags.TRIAGE_MOVE), 3),
    new Ability(Abilities.GALVANIZE, 7)
      .attr(MoveTypeChangeAttr, Type.ELECTRIC, 1.2, (user, target, move) => move.type === Type.NORMAL),
    new Ability(Abilities.SURGE_SURFER, 7)
      .conditionalAttr(getTerrainCondition(TerrainType.ELECTRIC), BattleStatMultiplierAbAttr, BattleStat.SPD, 2),
    new Ability(Abilities.SCHOOLING, 7)
      .attr(PostBattleInitFormChangeAbAttr, () => 0)
      .attr(PostSummonFormChangeAbAttr, p => p.level < 20 || p.getHpRatio() <= 0.25 ? 0 : 1)
      .attr(PostTurnFormChangeAbAttr, p => p.level < 20 || p.getHpRatio() <= 0.25 ? 0 : 1)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .bypassFaint(),
    new Ability(Abilities.DISGUISE, 7)
      .attr(PreDefendMoveDamageToOneAbAttr, (target, user, move) => target.formIndex === 0 && target.getAttackTypeEffectiveness(move.type, user) > 0)
      .attr(PostSummonFormChangeAbAttr, p => p.battleData.hitCount === 0 ? 0 : 1)
      .attr(PostBattleInitFormChangeAbAttr, () => 0)
      .attr(PostDefendFormChangeAbAttr, p => p.battleData.hitCount === 0 ? 0 : 1)
      .attr(PreDefendFormChangeAbAttr, p => p.battleData.hitCount === 0 ? 0 : 1)
      .attr(PostDefendDisguiseAbAttr)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .bypassFaint()
      .ignorable()
      .partial(),
    new Ability(Abilities.BATTLE_BOND, 7)
      .attr(PostVictoryFormChangeAbAttr, () => 2)
      .attr(PostBattleInitFormChangeAbAttr, () => 1)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .bypassFaint(),
    new Ability(Abilities.POWER_CONSTRUCT, 7) // TODO: 10% Power Construct Zygarde isn't accounted for yet. If changed, update Zygarde's getSpeciesFormIndex entry accordingly
      .attr(PostBattleInitFormChangeAbAttr, () => 2)
      .attr(PostSummonFormChangeAbAttr, p => p.getHpRatio() <= 0.5 || p.getFormKey() === "complete" ? 4 : 2)
      .attr(PostTurnFormChangeAbAttr, p => p.getHpRatio() <= 0.5 || p.getFormKey() === "complete" ? 4 : 2)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .bypassFaint()
      .partial(),
    new Ability(Abilities.CORROSION, 7) // TODO: Test Corrosion against Magic Bounce once it is implemented
      .attr(IgnoreTypeStatusEffectImmunityAbAttr, [StatusEffect.POISON, StatusEffect.TOXIC], [Type.STEEL, Type.POISON])
      .partial(),
    new Ability(Abilities.COMATOSE, 7)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(StatusEffectImmunityAbAttr, ...getNonVolatileStatusEffects())
      .attr(BattlerTagImmunityAbAttr, BattlerTagType.DROWSY),
    new Ability(Abilities.QUEENLY_MAJESTY, 7)
      .attr(FieldPriorityMoveImmunityAbAttr)
      .ignorable(),
    new Ability(Abilities.INNARDS_OUT, 7)
      .attr(PostFaintHPDamageAbAttr)
      .bypassFaint(),
    new Ability(Abilities.DANCER, 7)
      .attr(PostDancingMoveAbAttr),
    new Ability(Abilities.BATTERY, 7)
      .attr(AllyMoveCategoryPowerBoostAbAttr, [MoveCategory.SPECIAL], 1.3),
    new Ability(Abilities.FLUFFY, 7)
      .attr(ReceivedMoveDamageMultiplierAbAttr, (target, user, move) => move.hasFlag(MoveFlags.MAKES_CONTACT), 0.5)
      .attr(ReceivedMoveDamageMultiplierAbAttr, (target, user, move) => move.type === Type.FIRE, 2)
      .ignorable(),
    new Ability(Abilities.DAZZLING, 7)
      .attr(FieldPriorityMoveImmunityAbAttr)
      .ignorable(),
    new Ability(Abilities.SOUL_HEART, 7)
      .attr(PostKnockOutStatChangeAbAttr, BattleStat.SPATK, 1),
    new Ability(Abilities.TANGLING_HAIR, 7)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.hasFlag(MoveFlags.MAKES_CONTACT), BattleStat.SPD, -1, false),
    new Ability(Abilities.RECEIVER, 7)
      .attr(CopyFaintedAllyAbilityAbAttr)
      .attr(UncopiableAbilityAbAttr),
    new Ability(Abilities.POWER_OF_ALCHEMY, 7)
      .attr(CopyFaintedAllyAbilityAbAttr)
      .attr(UncopiableAbilityAbAttr),
    new Ability(Abilities.BEAST_BOOST, 7)
      .attr(PostVictoryStatChangeAbAttr, p => {
        const battleStats = Utils.getEnumValues(BattleStat).slice(0, -3).map(s => s as BattleStat);
        let highestBattleStat = 0;
        let highestBattleStatIndex = 0;
        battleStats.map((bs: BattleStat, i: integer) => {
          const stat = p.getStat(bs + 1);
          if (stat > highestBattleStat) {
            highestBattleStatIndex = i;
            highestBattleStat = stat;
          }
        });
        return highestBattleStatIndex;
      }, 1),
    new Ability(Abilities.RKS_SYSTEM, 7)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr),
    new Ability(Abilities.ELECTRIC_SURGE, 7)
      .attr(PostSummonTerrainChangeAbAttr, TerrainType.ELECTRIC)
      .attr(PostBiomeChangeTerrainChangeAbAttr, TerrainType.ELECTRIC),
    new Ability(Abilities.PSYCHIC_SURGE, 7)
      .attr(PostSummonTerrainChangeAbAttr, TerrainType.PSYCHIC)
      .attr(PostBiomeChangeTerrainChangeAbAttr, TerrainType.PSYCHIC),
    new Ability(Abilities.MISTY_SURGE, 7)
      .attr(PostSummonTerrainChangeAbAttr, TerrainType.MISTY)
      .attr(PostBiomeChangeTerrainChangeAbAttr, TerrainType.MISTY),
    new Ability(Abilities.GRASSY_SURGE, 7)
      .attr(PostSummonTerrainChangeAbAttr, TerrainType.GRASSY)
      .attr(PostBiomeChangeTerrainChangeAbAttr, TerrainType.GRASSY),
    new Ability(Abilities.FULL_METAL_BODY, 7)
      .attr(ProtectStatAbAttr),
    new Ability(Abilities.SHADOW_SHIELD, 7)
      .attr(ReceivedMoveDamageMultiplierAbAttr,(target, user, move) => target.isFullHp(), 0.5),
    new Ability(Abilities.PRISM_ARMOR, 7)
      .attr(ReceivedMoveDamageMultiplierAbAttr,(target, user, move) => target.getAttackTypeEffectiveness(move.type, user) >= 2, 0.75),
    new Ability(Abilities.NEUROFORCE, 7)
      .attr(MovePowerBoostAbAttr, (user, target, move) => target.getAttackTypeEffectiveness(move.type, user) >= 2, 1.25),
    new Ability(Abilities.INTREPID_SWORD, 8)
      .attr(PostSummonStatChangeAbAttr, BattleStat.ATK, 1, true)
      .condition(getOncePerBattleCondition(Abilities.INTREPID_SWORD)),
    new Ability(Abilities.DAUNTLESS_SHIELD, 8)
      .attr(PostSummonStatChangeAbAttr, BattleStat.DEF, 1, true)
      .condition(getOncePerBattleCondition(Abilities.DAUNTLESS_SHIELD)),
    new Ability(Abilities.LIBERO, 8)
      .attr(PokemonTypeChangeAbAttr),
    //.condition((p) => !p.summonData?.abilitiesApplied.includes(Abilities.LIBERO)), //Gen 9 Implementation
    new Ability(Abilities.BALL_FETCH, 8)
      .attr(FetchBallAbAttr)
      .condition(getOncePerBattleCondition(Abilities.BALL_FETCH)),
    new Ability(Abilities.COTTON_DOWN, 8)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.category !== MoveCategory.STATUS, BattleStat.SPD, -1, false, true)
      .bypassFaint(),
    new Ability(Abilities.PROPELLER_TAIL, 8)
      .attr(BlockRedirectAbAttr),
    new Ability(Abilities.MIRROR_ARMOR, 8)
      .ignorable()
      .unimplemented(),
    new Ability(Abilities.GULP_MISSILE, 8)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .unimplemented(),
    new Ability(Abilities.STALWART, 8)
      .attr(BlockRedirectAbAttr),
    new Ability(Abilities.STEAM_ENGINE, 8)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => (move.type === Type.FIRE || move.type === Type.WATER) && move.category !== MoveCategory.STATUS, BattleStat.SPD, 6),
    new Ability(Abilities.PUNK_ROCK, 8)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.hasFlag(MoveFlags.SOUND_BASED), 1.3)
      .attr(ReceivedMoveDamageMultiplierAbAttr, (target, user, move) => move.hasFlag(MoveFlags.SOUND_BASED), 0.5)
      .ignorable(),
    new Ability(Abilities.SAND_SPIT, 8)
      .attr(PostDefendWeatherChangeAbAttr, WeatherType.SANDSTORM),
    new Ability(Abilities.ICE_SCALES, 8)
      .attr(ReceivedMoveDamageMultiplierAbAttr, (target, user, move) => move.category === MoveCategory.SPECIAL, 0.5)
      .ignorable(),
    new Ability(Abilities.RIPEN, 8)
      .attr(DoubleBerryEffectAbAttr),
    new Ability(Abilities.ICE_FACE, 8)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      // Add BattlerTagType.ICE_FACE if the pokemon is in ice face form
      .conditionalAttr(pokemon => pokemon.formIndex === 0, PostSummonAddBattlerTagAbAttr, BattlerTagType.ICE_FACE, 0, false)
      // When summoned with active HAIL or SNOW, add BattlerTagType.ICE_FACE
      .conditionalAttr(getWeatherCondition(WeatherType.HAIL, WeatherType.SNOW), PostSummonAddBattlerTagAbAttr, BattlerTagType.ICE_FACE, 0)
      // When weather changes to HAIL or SNOW while pokemon is fielded, add BattlerTagType.ICE_FACE
      .attr(PostWeatherChangeAddBattlerTagAttr, BattlerTagType.ICE_FACE, 0, WeatherType.HAIL, WeatherType.SNOW)
      .attr(IceFaceBlockPhysicalAbAttr, (target, user, move) => move.category === MoveCategory.PHYSICAL && !!target.getTag(BattlerTagType.ICE_FACE), 0)
      .ignorable(),
    new Ability(Abilities.POWER_SPOT, 8)
      .attr(AllyMoveCategoryPowerBoostAbAttr, [MoveCategory.SPECIAL, MoveCategory.PHYSICAL], 1.3),
    new Ability(Abilities.MIMICRY, 8)
      .unimplemented(),
    new Ability(Abilities.SCREEN_CLEANER, 8)
      .attr(PostSummonRemoveArenaTagAbAttr, [ArenaTagType.AURORA_VEIL, ArenaTagType.LIGHT_SCREEN, ArenaTagType.REFLECT]),
    new Ability(Abilities.STEELY_SPIRIT, 8)
      .attr(UserFieldMoveTypePowerBoostAbAttr, Type.STEEL),
    new Ability(Abilities.PERISH_BODY, 8)
      .attr(PostDefendPerishSongAbAttr, 4),
    new Ability(Abilities.WANDERING_SPIRIT, 8)
      .attr(PostDefendAbilitySwapAbAttr)
      .bypassFaint()
      .partial(),
    new Ability(Abilities.GORILLA_TACTICS, 8)
      .unimplemented(),
    new Ability(Abilities.NEUTRALIZING_GAS, 8)
      .attr(SuppressFieldAbilitiesAbAttr)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .attr(PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonNeutralizingGas", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }))
      .partial(),
    new Ability(Abilities.PASTEL_VEIL, 8)
      .attr(PostSummonUserFieldRemoveStatusEffectAbAttr, StatusEffect.POISON, StatusEffect.TOXIC)
      .attr(UserFieldStatusEffectImmunityAbAttr, StatusEffect.POISON, StatusEffect.TOXIC)
      .ignorable(),
    new Ability(Abilities.HUNGER_SWITCH, 8)
      .attr(PostTurnFormChangeAbAttr, p => p.getFormKey ? 0 : 1)
      .attr(PostTurnFormChangeAbAttr, p => p.getFormKey ? 1 : 0)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .condition((pokemon) => !pokemon.isTerastallized()),
    new Ability(Abilities.QUICK_DRAW, 8)
      .attr(BypassSpeedChanceAbAttr, 30),
    new Ability(Abilities.UNSEEN_FIST, 8)
      .attr(IgnoreProtectOnContactAbAttr),
    new Ability(Abilities.CURIOUS_MEDICINE, 8)
      .attr(PostSummonClearAllyStatsAbAttr),
    new Ability(Abilities.TRANSISTOR, 8)
      .attr(MoveTypePowerBoostAbAttr, Type.ELECTRIC),
    new Ability(Abilities.DRAGONS_MAW, 8)
      .attr(MoveTypePowerBoostAbAttr, Type.DRAGON),
    new Ability(Abilities.CHILLING_NEIGH, 8)
      .attr(PostVictoryStatChangeAbAttr, BattleStat.ATK, 1),
    new Ability(Abilities.GRIM_NEIGH, 8)
      .attr(PostVictoryStatChangeAbAttr, BattleStat.SPATK, 1),
    new Ability(Abilities.AS_ONE_GLASTRIER, 8)
      .attr(PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonAsOneGlastrier", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }))
      .attr(PreventBerryUseAbAttr)
      .attr(PostVictoryStatChangeAbAttr, BattleStat.ATK, 1)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr),
    new Ability(Abilities.AS_ONE_SPECTRIER, 8)
      .attr(PostSummonMessageAbAttr, (pokemon: Pokemon) => i18next.t("abilityTriggers:postSummonAsOneSpectrier", { pokemonNameWithAffix: getPokemonNameWithAffix(pokemon) }))
      .attr(PreventBerryUseAbAttr)
      .attr(PostVictoryStatChangeAbAttr, BattleStat.SPATK, 1)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr),
    new Ability(Abilities.LINGERING_AROMA, 9)
      .attr(PostDefendAbilityGiveAbAttr, Abilities.LINGERING_AROMA)
      .bypassFaint(),
    new Ability(Abilities.SEED_SOWER, 9)
      .attr(PostDefendTerrainChangeAbAttr, TerrainType.GRASSY),
    new Ability(Abilities.THERMAL_EXCHANGE, 9)
      .attr(PostDefendStatChangeAbAttr, (target, user, move) => move.type === Type.FIRE && move.category !== MoveCategory.STATUS, BattleStat.ATK, 1)
      .attr(StatusEffectImmunityAbAttr, StatusEffect.BURN)
      .ignorable(),
    new Ability(Abilities.ANGER_SHELL, 9)
      .attr(PostDefendHpGatedStatChangeAbAttr, (target, user, move) => move.category !== MoveCategory.STATUS, 0.5, [ BattleStat.ATK, BattleStat.SPATK, BattleStat.SPD ], 1)
      .attr(PostDefendHpGatedStatChangeAbAttr, (target, user, move) => move.category !== MoveCategory.STATUS, 0.5, [ BattleStat.DEF, BattleStat.SPDEF ], -1)
      .condition(getSheerForceHitDisableAbCondition()),
    new Ability(Abilities.PURIFYING_SALT, 9)
      .attr(StatusEffectImmunityAbAttr)
      .attr(ReceivedTypeDamageMultiplierAbAttr, Type.GHOST, 0.5)
      .ignorable(),
    new Ability(Abilities.WELL_BAKED_BODY, 9)
      .attr(TypeImmunityStatChangeAbAttr, Type.FIRE, BattleStat.DEF, 2)
      .ignorable(),
    new Ability(Abilities.WIND_RIDER, 9)
      .attr(MoveImmunityStatChangeAbAttr, (pokemon, attacker, move) => pokemon !== attacker && move.hasFlag(MoveFlags.WIND_MOVE) && move.category !== MoveCategory.STATUS, BattleStat.ATK, 1)
      .attr(PostSummonStatChangeOnArenaAbAttr, ArenaTagType.TAILWIND)
      .ignorable(),
    new Ability(Abilities.GUARD_DOG, 9)
      .attr(PostIntimidateStatChangeAbAttr, [BattleStat.ATK], 1, true)
      .attr(ForceSwitchOutImmunityAbAttr)
      .ignorable(),
    new Ability(Abilities.ROCKY_PAYLOAD, 9)
      .attr(MoveTypePowerBoostAbAttr, Type.ROCK),
    new Ability(Abilities.WIND_POWER, 9)
      .attr(PostDefendApplyBattlerTagAbAttr, (target, user, move) => move.hasFlag(MoveFlags.WIND_MOVE), BattlerTagType.CHARGED),
    new Ability(Abilities.ZERO_TO_HERO, 9)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr)
      .attr(PostBattleInitFormChangeAbAttr, () => 0)
      .attr(PreSwitchOutFormChangeAbAttr, () => 1)
      .bypassFaint(),
    new Ability(Abilities.COMMANDER, 9)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .unimplemented(),
    new Ability(Abilities.ELECTROMORPHOSIS, 9)
      .attr(PostDefendApplyBattlerTagAbAttr, (target, user, move) => move.category !== MoveCategory.STATUS, BattlerTagType.CHARGED),
    new Ability(Abilities.PROTOSYNTHESIS, 9)
      .conditionalAttr(getWeatherCondition(WeatherType.SUNNY, WeatherType.HARSH_SUN), PostSummonAddBattlerTagAbAttr, BattlerTagType.PROTOSYNTHESIS, 0, true)
      .attr(PostWeatherChangeAddBattlerTagAttr, BattlerTagType.PROTOSYNTHESIS, 0, WeatherType.SUNNY, WeatherType.HARSH_SUN)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .partial(), // While setting the tag, the getbattlestat should ignore all modifiers to stats except stat stages
    new Ability(Abilities.QUARK_DRIVE, 9)
      .conditionalAttr(getTerrainCondition(TerrainType.ELECTRIC), PostSummonAddBattlerTagAbAttr, BattlerTagType.QUARK_DRIVE, 0, true)
      .attr(PostTerrainChangeAddBattlerTagAttr, BattlerTagType.QUARK_DRIVE, 0, TerrainType.ELECTRIC)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .partial(), // While setting the tag, the getbattlestat should ignore all modifiers to stats except stat stages
    new Ability(Abilities.GOOD_AS_GOLD, 9)
      .attr(MoveImmunityAbAttr, (pokemon, attacker, move) => pokemon !== attacker && move.category === MoveCategory.STATUS)
      .ignorable()
      .partial(),
    new Ability(Abilities.VESSEL_OF_RUIN, 9)
      .attr(FieldMultiplyBattleStatAbAttr, Stat.SPATK, 0.75)
      .attr(PostSummonMessageAbAttr, (user) => i18next.t("abilityTriggers:postSummonVesselOfRuin", { pokemonNameWithAffix: getPokemonNameWithAffix(user), statName: getStatName(Stat.SPATK) }))
      .ignorable(),
    new Ability(Abilities.SWORD_OF_RUIN, 9)
      .attr(FieldMultiplyBattleStatAbAttr, Stat.DEF, 0.75)
      .attr(PostSummonMessageAbAttr, (user) => i18next.t("abilityTriggers:postSummonSwordOfRuin", { pokemonNameWithAffix: getPokemonNameWithAffix(user), statName: getStatName(Stat.DEF) }))
      .ignorable(),
    new Ability(Abilities.TABLETS_OF_RUIN, 9)
      .attr(FieldMultiplyBattleStatAbAttr, Stat.ATK, 0.75)
      .attr(PostSummonMessageAbAttr, (user) => i18next.t("abilityTriggers:postSummonTabletsOfRuin", { pokemonNameWithAffix: getPokemonNameWithAffix(user), statName: getStatName(Stat.ATK) }))
      .ignorable(),
    new Ability(Abilities.BEADS_OF_RUIN, 9)
      .attr(FieldMultiplyBattleStatAbAttr, Stat.SPDEF, 0.75)
      .attr(PostSummonMessageAbAttr, (user) => i18next.t("abilityTriggers:postSummonBeadsOfRuin", { pokemonNameWithAffix: getPokemonNameWithAffix(user), statName: getStatName(Stat.SPDEF) }))
      .ignorable(),
    new Ability(Abilities.ORICHALCUM_PULSE, 9)
      .attr(PostSummonWeatherChangeAbAttr, WeatherType.SUNNY)
      .attr(PostBiomeChangeWeatherChangeAbAttr, WeatherType.SUNNY)
      .conditionalAttr(getWeatherCondition(WeatherType.SUNNY, WeatherType.HARSH_SUN), BattleStatMultiplierAbAttr, BattleStat.ATK, 4 / 3),
    new Ability(Abilities.HADRON_ENGINE, 9)
      .attr(PostSummonTerrainChangeAbAttr, TerrainType.ELECTRIC)
      .attr(PostBiomeChangeTerrainChangeAbAttr, TerrainType.ELECTRIC)
      .conditionalAttr(getTerrainCondition(TerrainType.ELECTRIC), BattleStatMultiplierAbAttr, BattleStat.SPATK, 4 / 3),
    new Ability(Abilities.OPPORTUNIST, 9)
      .attr(StatChangeCopyAbAttr),
    new Ability(Abilities.CUD_CHEW, 9)
      .unimplemented(),
    new Ability(Abilities.SHARPNESS, 9)
      .attr(MovePowerBoostAbAttr, (user, target, move) => move.hasFlag(MoveFlags.SLICING_MOVE), 1.5),
    new Ability(Abilities.SUPREME_OVERLORD, 9)
      .attr(VariableMovePowerBoostAbAttr, (user, target, move) => 1 + 0.1 * Math.min(user.isPlayer() ? user.scene.currentBattle.playerFaints : user.scene.currentBattle.enemyFaints, 5))
      .partial(),
    new Ability(Abilities.COSTAR, 9)
      .attr(PostSummonCopyAllyStatsAbAttr),
    new Ability(Abilities.TOXIC_DEBRIS, 9)
      .attr(PostDefendApplyArenaTrapTagAbAttr, (target, user, move) => move.category === MoveCategory.PHYSICAL, ArenaTagType.TOXIC_SPIKES)
      .bypassFaint(),
    new Ability(Abilities.ARMOR_TAIL, 9)
      .attr(FieldPriorityMoveImmunityAbAttr)
      .ignorable(),
    new Ability(Abilities.EARTH_EATER, 9)
      .attr(TypeImmunityHealAbAttr, Type.GROUND)
      .partial() // Healing not blocked by Heal Block
      .ignorable(),
    new Ability(Abilities.MYCELIUM_MIGHT, 9)
      .attr(MoveAbilityBypassAbAttr, (pokemon, move: Move) => move.category === MoveCategory.STATUS)
      .partial(),
    new Ability(Abilities.MINDS_EYE, 9)
      .attr(IgnoreTypeImmunityAbAttr, Type.GHOST, [Type.NORMAL, Type.FIGHTING])
      .attr(ProtectStatAbAttr, BattleStat.ACC)
      .attr(IgnoreOpponentEvasionAbAttr)
      .ignorable(),
    new Ability(Abilities.SUPERSWEET_SYRUP, 9)
      .attr(PostSummonStatChangeAbAttr, BattleStat.EVA, -1)
      .condition(getOncePerBattleCondition(Abilities.SUPERSWEET_SYRUP)),
    new Ability(Abilities.HOSPITALITY, 9)
      .attr(PostSummonAllyHealAbAttr, 4, true)
      .partial(), // Healing not blocked by Heal Block
    new Ability(Abilities.TOXIC_CHAIN, 9)
      .attr(PostAttackApplyStatusEffectAbAttr, false, 30, StatusEffect.TOXIC),
    new Ability(Abilities.EMBODY_ASPECT_TEAL, 9)
      .attr(PostBattleInitStatChangeAbAttr, BattleStat.SPD, 1, true)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .partial(),
    new Ability(Abilities.EMBODY_ASPECT_WELLSPRING, 9)
      .attr(PostBattleInitStatChangeAbAttr, BattleStat.SPDEF, 1, true)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .partial(),
    new Ability(Abilities.EMBODY_ASPECT_HEARTHFLAME, 9)
      .attr(PostBattleInitStatChangeAbAttr, BattleStat.ATK, 1, true)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .partial(),
    new Ability(Abilities.EMBODY_ASPECT_CORNERSTONE, 9)
      .attr(PostBattleInitStatChangeAbAttr, BattleStat.DEF, 1, true)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .partial(),
    new Ability(Abilities.TERA_SHIFT, 9)
      .attr(PostSummonFormChangeAbAttr, p => p.getFormKey() ? 0 : 1)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .attr(UnsuppressableAbilityAbAttr)
      .attr(NoTransformAbilityAbAttr)
      .attr(NoFusionAbilityAbAttr),
    new Ability(Abilities.TERA_SHELL, 9)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .ignorable()
      .unimplemented(),
    new Ability(Abilities.TERAFORM_ZERO, 9)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .unimplemented(),
    new Ability(Abilities.POISON_PUPPETEER, 9)
      .attr(UncopiableAbilityAbAttr)
      .attr(UnswappableAbilityAbAttr)
      .conditionalAttr(pokemon => pokemon.species.speciesId===Species.PECHARUNT,ConfusionOnStatusEffectAbAttr,StatusEffect.POISON,StatusEffect.TOXIC)
  );
}
