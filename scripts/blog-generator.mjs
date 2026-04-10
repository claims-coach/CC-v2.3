#!/usr/bin/env node

/**
 * Blog Post Generator for Claims.Coach
 * Auto-generates Appraisal Clause focused blog posts
 * Posts to GHL blog via API
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// GHL API Configuration
const GHL_API_KEY = process.env.GHL_API_KEY || "pit-9fc4a175-3f79-4cc2-8e33-4f8ef0ac78c1";
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || "Lud9I0SSpb992pgRS4gJ";
const GHL_BLOG_ID = process.env.GHL_BLOG_ID || "claims-coach-main";

/**
 * Generate a blog post about Appraisal Clauses
 */
async function generateBlogPost(topic) {
  const prompt = `You are a content strategist for Claims.Coach, a public adjusting firm specializing in appraisal clause disputes.

Generate a comprehensive, SEO-optimized blog post about: "${topic}"

Focus on:
- What is an appraisal clause and why it matters
- How policyholders can trigger an appraisal
- Benefits vs. waiting for insurer settlement
- Common misconceptions about appraisals
- When appraisals are the right move
- Real-world examples (anonymized)

Write in friendly, non-technical language (target: high school reading level).
Include a clear call-to-action at the end (contact Claims.Coach for free consultation).

Format as JSON with:
{
  "title": "SEO-friendly title (under 60 chars)",
  "slug": "url-slug-version-of-title",
  "excerpt": "2-3 sentence summary for preview",
  "content": "Full blog post in HTML (use <h2>, <p>, <ul> tags)",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "readTime": 5,
  "featured": true
}`;

  console.log("🤖 Generating blog post...\n");

  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract JSON from Claude response");
  }

  return JSON.parse(jsonMatch[0]);
}

/**
 * Post to GHL blog via API
 */
async function postToGHLBlog(blogPost) {
  console.log("📤 Posting to GHL blog...\n");

  const payload = {
    title: blogPost.title,
    slug: blogPost.slug,
    metaDescription: blogPost.excerpt,
    body: blogPost.content,
    featured: blogPost.featured,
    keywords: blogPost.keywords.join(", "),
  };

  const res = await fetch(
    `https://services.leadconnectorhq.com/blogs/posts?locationId=${GHL_LOCATION_ID}&blogId=${GHL_BLOG_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`GHL API error: ${res.status} - ${error}`);
  }

  const data = await res.json();
  console.log(`✅ Posted to GHL: ${data.data?.id || "success"}\n`);
  return data;
}

/**
 * Main function
 */
async function main() {
  const topics = [
    "What is an Appraisal Clause and Why Every Policyholder Should Know About It",
    "How to Trigger an Appraisal Dispute When Your Insurance Company Lowballs You",
    "Appraisal vs. Negotiation: When to Fight Your Insurer's Valuation",
    "The Step-by-Step Process of a Vehicle Appraisal Dispute",
    "Common Insurance Company Tactics to Avoid During Appraisal Disputes",
    "How Appraisal Clauses Protect Accident Victims from Settlement Lowballs",
    "Do You Really Need a Public Adjuster for an Appraisal Dispute?",
    "Appraisal Clause Rights: What Your Insurance Policy Actually Guarantees",
  ];

  // Pick random topic
  const topic = topics[Math.floor(Math.random() * topics.length)];

  try {
    // Generate blog post
    const blogPost = await generateBlogPost(topic);

    console.log(`📝 Generated: "${blogPost.title}"`);
    console.log(`   Slug: ${blogPost.slug}`);
    console.log(`   Read time: ${blogPost.readTime} min\n`);

    // Post to GHL
    await postToGHLBlog(blogPost);

    console.log("✅ Blog post published successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
