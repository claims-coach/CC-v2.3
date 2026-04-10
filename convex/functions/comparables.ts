// ============================================================
// functions/comparables.ts — VIN-mandatory comparable management
// ============================================================

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

/**
 * addComparable — hard-stops on missing/invalid VIN.
 */
export const addComparable = mutation({
  args: {
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
    compNumber: v.number(),
    listingUrl: v.string(),
    sourceName: v.string(),
    askingPrice: v.number(),
    mileage: v.number(),
    vin: v.string(),
    vehicleYear: v.number(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleTrim: v.string(),
    dealerName: v.string(),
    dealerCity: v.string(),
    dealerState: v.string(),
    distanceMiles: v.number(),
    mileageAdjustmentRate: v.number(),
    subjectMileage: v.number(),
  },
  handler: async (ctx, args) => {
    // ---- VIN enforcement (non-negotiable) ----
    if (!args.vin || args.vin.trim().length === 0) {
      throw new Error("🔴 HARD STOP: VIN is mandatory. No VIN = comp INVALID. Cannot create record.");
    }
    const vin = args.vin.trim().toUpperCase();
    if (!VIN_REGEX.test(vin)) {
      throw new Error(`🔴 HARD STOP: Invalid VIN format: "${args.vin}". Must be 17 alphanumeric characters (no I, O, Q).`);
    }

    // ---- Duplicate VIN check within same parent ----
    const existing = await ctx.db
      .query("comparables")
      .withIndex("by_parent", (q) => q.eq("parentType", args.parentType).eq("parentId", args.parentId))
      .collect();

    if (existing.some((c) => c.vin === vin)) {
      throw new Error(`🔴 Duplicate VIN ${vin} already exists for ${args.parentType} ${args.parentId}.`);
    }

    // ---- Mileage adjustment ----
    const mileageDelta = args.subjectMileage - args.mileage;
    const mileageAdjustmentAmount = Math.round(mileageDelta * args.mileageAdjustmentRate * 100) / 100;
    const adjustedValue = Math.round((args.askingPrice + mileageAdjustmentAmount) * 100) / 100;

    const now = Date.now();
    const docId = await ctx.db.insert("comparables", {
      parentType: args.parentType,
      parentId: args.parentId,
      compNumber: args.compNumber,
      listingUrl: args.listingUrl,
      sourceName: args.sourceName,
      askingPrice: args.askingPrice,
      mileage: args.mileage,
      vin,
      vehicleYear: args.vehicleYear,
      vehicleMake: args.vehicleMake,
      vehicleModel: args.vehicleModel,
      vehicleTrim: args.vehicleTrim,
      dealerName: args.dealerName,
      dealerCity: args.dealerCity,
      dealerState: args.dealerState,
      distanceMiles: args.distanceMiles,
      mileageAdjustmentRate: args.mileageAdjustmentRate,
      mileageAdjustmentAmount,
      adjustedValue,
      listingVerifiedLiveAt: now,
      isValid: true,
      createdAt: now,
      updatedAt: now,
    });

    return { _id: docId, vin, adjustedValue, mileageAdjustmentAmount };
  },
});

/**
 * invalidateComparable — marks a comp invalid with reason.
 */
export const invalidateComparable = mutation({
  args: {
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
    vin: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const comps = await ctx.db
      .query("comparables")
      .withIndex("by_vin", (q) => q.eq("vin", args.vin.toUpperCase()))
      .collect();

    const comp = comps.find(
      (c) => c.parentType === args.parentType && c.parentId === args.parentId
    );
    if (!comp) throw new Error(`Comp with VIN ${args.vin} not found for ${args.parentId}.`);

    await ctx.db.patch(comp._id, {
      isValid: false,
      invalidReason: args.reason,
      updatedAt: Date.now(),
    });
  },
});

/**
 * listByParent — all comps for a prospect or matter.
 */
export const listByParent = query({
  args: {
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
  },
  handler: async (ctx, { parentType, parentId }) =>
    ctx.db
      .query("comparables")
      .withIndex("by_parent", (q) => q.eq("parentType", parentType).eq("parentId", parentId))
      .collect(),
});

/**
 * getValidCount — number of valid comps for sufficiency checks.
 */
export const getValidCount = query({
  args: {
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
  },
  handler: async (ctx, { parentType, parentId }) => {
    const all = await ctx.db
      .query("comparables")
      .withIndex("by_parent", (q) => q.eq("parentType", parentType).eq("parentId", parentId))
      .collect();
    return all.filter((c) => c.isValid).length;
  },
});

/**
 * computePreliminaryAcv — average of valid adjusted values.
 */
export const computePreliminaryAcv = query({
  args: {
    parentType: v.union(v.literal("prospect"), v.literal("matter")),
    parentId: v.string(),
  },
  handler: async (ctx, { parentType, parentId }) => {
    const all = await ctx.db
      .query("comparables")
      .withIndex("by_parent", (q) => q.eq("parentType", parentType).eq("parentId", parentId))
      .collect();
    const valid = all.filter((c) => c.isValid);
    if (valid.length === 0) return { acv: null, count: 0 };
    const sum = valid.reduce((s, c) => s + c.adjustedValue, 0);
    return {
      acv: Math.round((sum / valid.length) * 100) / 100,
      count: valid.length,
    };
  },
});
