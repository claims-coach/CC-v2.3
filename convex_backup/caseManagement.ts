import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const getNextCaseNumber = query({
  args: {},
  async handler(ctx) {
    const lastCase = await ctx.db
      .query('cases')
      .order('desc')
      .take(1);

    if (lastCase.length === 0) return 150; // Start at 000150
    const lastId = parseInt(lastCase[0].masterId.split('_')[0], 10);
    return lastId + 1;
  },
});

export const createCase = mutation({
  args: {
    clientName: v.string(),
    clientPhone: v.string(),
    clientEmail: v.optional(v.string()),
    carrier: v.string(),
    claimType: v.union(v.literal('DV'), v.literal('ACV'), v.literal('UMP'), v.literal('EXP'), v.literal('CON'), v.literal('LIT'), v.literal('OTH')),
    vehicleYear: v.optional(v.number()),
    vehicleMake: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    vehicleVin: v.optional(v.string()),
    vehicleMileage: v.optional(v.number()),
    insuranceEstimate: v.optional(v.string()),
    dateOfLoss: v.optional(v.string()),
    notes: v.optional(v.string()),
    source: v.union(v.literal('ghl_booking'), v.literal('manual_form'), v.literal('intake_call')),
  },
  async handler(ctx, args) {
    // Get next case number
    const lastCase = await ctx.db.query('cases').order('desc').take(1);
    const nextNum = lastCase.length === 0 ? 150 : parseInt(lastCase[0].masterId.split('_')[0], 10) + 1;
    const masterId = `${String(nextNum).padStart(6, '0')}_${new Date().getFullYear().toString().slice(-2)}-AUTO-${args.claimType}_${args.clientName.split(' ').pop()}_${args.carrier}`;

    // Create case record
    const caseId = await ctx.db.insert('cases', {
      masterId,
      status: 'intake',
      clientName: args.clientName,
      clientPhone: args.clientPhone,
      clientEmail: args.clientEmail,
      carrier: args.carrier,
      claimType: args.claimType,
      vehicleYear: args.vehicleYear,
      vehicleMake: args.vehicleMake,
      vehicleModel: args.vehicleModel,
      vehicleVin: args.vehicleVin,
      vehicleMileage: args.vehicleMileage,
      insuranceEstimate: args.insuranceEstimate,
      dateOfLoss: args.dateOfLoss,
      notes: args.notes,
      source: args.source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { masterId, caseId };
  },
});

export const getCaseByMasterId = query({
  args: { masterId: v.string() },
  async handler(ctx, args) {
    const cases = await ctx.db.query('cases').filter((q) => q.eq(q.field('masterId'), args.masterId)).take(1);
    return cases.length > 0 ? cases[0] : null;
  },
});

export const listCases = query({
  args: { status: v.optional(v.string()) },
  async handler(ctx, args) {
    let query = ctx.db.query('cases');
    if (args.status) {
      query = query.filter((q) => q.eq(q.field('status'), args.status));
    }
    return await query.order('desc').take(100);
  },
});

export const updateCaseStatus = mutation({
  args: {
    masterId: v.string(),
    status: v.union(v.literal('intake'), v.literal('valuation'), v.literal('report'), v.literal('review'), v.literal('negotiation'), v.literal('closed')),
  },
  async handler(ctx, args) {
    const caseRecord = await ctx.db
      .query('cases')
      .filter((q) => q.eq(q.field('masterId'), args.masterId))
      .take(1);

    if (caseRecord.length === 0) throw new Error('Case not found');

    await ctx.db.patch(caseRecord[0]._id, {
      status: args.status,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  },
});
