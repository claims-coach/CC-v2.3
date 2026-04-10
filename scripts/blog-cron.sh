#!/bin/bash
# Blog Post Cron Job
# Runs nightly at 7 AM PST to generate and post Appraisal Clause blog content

cd ~/claims-coach-mc

# Generate and post blog
node scripts/blog-generator.mjs >> ~/.openclaw/workspace/.blog-cron.log 2>&1

# Log result
if [ $? -eq 0 ]; then
    echo "✅ Blog post generated and posted at $(date)" >> ~/.openclaw/workspace/.blog-cron.log
else
    echo "❌ Blog post generation failed at $(date)" >> ~/.openclaw/workspace/.blog-cron.log
fi
