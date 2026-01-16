# Exactly Image Generator - Demo Script

## Overview
This demo showcases the Jahia Exactly Image Generator module, which integrates Exactly.ai's AI image generation capabilities into Jahia CMS.

**Duration:** 10-15 minutes  
**Prerequisites:** 
- Jahia instance running with the module deployed
- Exactly.ai API key configured
- Jahia Media Manager with sample images for training

---

## Demo Flow

### Part 1: Introduction (1 min)

**Say:**
> "Today I'll demonstrate the Exactly Image Generator module for Jahia. This module integrates Exactly.ai's advanced AI image generation directly into your Jahia CMS workflow. With this tool, you can train custom AI models on your brand's visual style and generate on-brand images without leaving Jahia."

**Show:**
- Navigate to **Tools → Exactly Image Generator** in Jahia admin panel
- Point out the three-step wizard interface

---

### Part 2: Style Management (2-3 min)

**Say:**
> "First, let's sync our Exactly.ai styles. If you've already created styles in Exactly.ai, they'll appear here. Otherwise, you can create new styles directly through the Exactly.ai interface."

**Steps:**
1. Click **"Sync Styles"** button in Step 1
2. Show the styles list that appears with status badges
3. Point out the style information:
   - Style name
   - Status (draft, training, ready)
   - Model type (Fast or Quality)

**Say:**
> "Each style represents a custom AI model trained on specific visual characteristics. Styles can be deleted if no longer needed, and we can see their current training status at a glance."

**Action:**
- Click on a style to select it (or create a new one if demo environment is fresh)
- Click **"Next"** to proceed to training

---

### Part 3: Model Training (4-5 min)

**Say:**
> "Now we'll train our AI model. Training requires uploading sample images that represent the visual style we want the AI to learn - this could be product photos, architectural renders, illustrations, or any consistent visual style."

**Steps:**

1. **Upload from Jahia Media Manager:**
   - Click **"Select from Jahia Media Manager"**
   - Navigate through the media library
   - Select 10-20 images with consistent style
   - Show the thumbnails appearing in the interface

**Say:**
> "Notice how we're selecting images directly from Jahia's Media Manager - no need to download and re-upload files."

2. **Upload Images to Exactly.ai:**
   - Click **"Upload to Exactly"** button
   - Show the upload progress indicators on each thumbnail
   - Point out the uploaded images list with preview thumbnails

**Say:**
> "These images are now uploaded to Exactly.ai's training platform. We can see previews and manage them here. If we need to remove any image, we can simply click the delete icon."

3. **Start Training:**
   - Click **"Start Training"** button
   - **Immediately** show the training status appearing:
     - Job ID
     - Status badge showing "training"
     - Circular progress indicator
     - Cancel Training button

**Say:**
> "Training starts immediately, and we can monitor the progress in real-time. The circular indicator shows the training percentage, and we can see the current status. If needed, we can cancel training at any time using the Cancel button."

4. **Wait for Progress Update (or simulate):**
   - Show the progress updating every 5 seconds
   - Point out how the percentage increases
   - Show when status changes to "ready"

**Say:**
> "Training typically takes 5-10 minutes depending on the number of images and model complexity. Once complete, the status changes to 'ready' and we can start generating images."

---

### Part 4: Image Generation (5-6 min)

**Say:**
> "Now the exciting part - generating AI images! We can create unique images by providing text prompts, and they'll match the visual style we just trained."

**Steps:**

1. **Navigate to Generate Step:**
   - Click **"Next"** to Step 3
   - Show the generation interface

2. **Basic Image Generation:**
   
**Say:**
> "Let's generate our first image with a simple prompt."

**Action:**
   - Enter prompt: `"A modern office workspace with plants and natural lighting"`
   - Set number of images: `4`
   - Click **"Generate"**
   - Show the loading state
   - Display the generated images in the grid

**Say:**
> "Within seconds, we get multiple variations based on our prompt. Each image reflects the visual style from our training data."

3. **Using Reference Images:**

**Say:**
> "But there's more - we can also use reference images to guide the generation. This is perfect when you want the AI to match a specific composition, style, or product."

**Action:**
   - Check **"Use Reference Images"** checkbox
   - Click **"Add Reference Image"**
   - Select an image from Jahia Media Manager
   - Set the purpose dropdown to **"Style"**
   - Adjust strength to **70**
   - Enter new prompt: `"Product photography in the same style"`
   - Click **"Generate"**

**Say:**
> "The reference image acts as a visual guide. We can control its influence with the strength parameter - higher values make the output more similar to the reference. The purpose parameter tells the AI how to interpret the reference: as a style guide, a sketch, a composition reference, or even as product/character input."

4. **Demonstrate Multiple Reference Images:**
   - Add a second reference image
   - Set different purpose: **"Reference"**
   - Set strength: **50**
   - Generate with prompt: `"Combine both visual elements"`
   - Show results

**Say:**
> "We can even use multiple reference images together, each with its own purpose and strength. This gives us incredible control over the final output."

5. **Save to Jahia Media Manager:**

**Say:**
> "Once we're happy with the results, we can save them directly back to Jahia's Media Manager."

**Action:**
   - Select generated images (click checkboxes)
   - Enter Target Folder Path: `/sites/mysite/files/ai-generated`
   - Enter filename prefix: `office-workspace`
   - Click **"Save to Jahia Media Manager"**
   - Show success message

**Say:**
> "The images are now saved to our site's media folder with automatic sequential numbering. They're immediately available for use in pages, components, or any Jahia content."

---

### Part 5: Advanced Features Highlight (2-3 min)

**Say:**
> "Let me quickly highlight some additional features that make this tool production-ready:"

**Points to Cover:**

1. **Reference Image Validation:**
   - "Reference images are automatically validated - maximum 2.5MB to ensure fast processing"
   - "Images are properly encoded and validated before sending to the API"

2. **Purpose Options:**
   - Show dropdown with all 6 purposes:
     - **Sketch** - Use drawings/sketches as input
     - **Style** - Match artistic style
     - **Reference** - General visual reference
     - **Instruct** - Specific instructions via image
     - **Product** - Product-specific generation
     - **Character** - Character consistency
   
3. **Dialog Confirmations:**
   - "All destructive actions use proper confirmation dialogs"
   - Demonstrate: Try to delete a style → shows Material-UI dialog
   - "No more accidental deletions with JavaScript alerts"

4. **Real-time Status Updates:**
   - "Training progress updates automatically every 5 seconds"
   - "Status badges clearly indicate: draft (gray), training (orange), ready (green), failed (red)"

5. **Site Integration:**
   - "Target folder paths automatically use the current site's key"
   - "Perfect for multi-site environments"

---

### Part 6: Use Cases & Closing (1-2 min)

**Say:**
> "This tool opens up several powerful use cases:"

**Use Cases:**
1. **Brand-Consistent Content Creation:**
   - "Marketing teams can generate on-brand visuals without designers"
   
2. **Product Visualization:**
   - "Create product mockups in various settings using reference images"
   
3. **Content Variation:**
   - "Generate multiple variations of hero images for A/B testing"
   
4. **Rapid Prototyping:**
   - "Quickly visualize concepts during content planning"
   
5. **Localized Content:**
   - "Generate culturally-appropriate variations while maintaining brand style"

**Say:**
> "All of this happens without leaving Jahia - seamless integration with your existing content workflow. Images go directly into the Media Manager where editors can immediately use them in pages and components."

**Closing:**
> "The Exactly Image Generator brings enterprise-grade AI image generation into Jahia CMS, making it accessible to content editors while maintaining brand consistency and quality control."

---

## Demo Tips

### Preparation Checklist
- [ ] Have Exactly.ai API key configured in module settings
- [ ] Prepare a style with 15-20 consistent training images
- [ ] Have some reference images ready in Jahia Media Manager
- [ ] Create a test site folder for saving generated images
- [ ] Test the full flow once before the demo
- [ ] Have interesting prompts prepared (see below)

### Recommended Prompts
**For Architecture/Interior:**
- "Modern minimalist living room with floor-to-ceiling windows"
- "Cozy cafe interior with warm lighting and wooden furniture"
- "Futuristic office space with glass walls and greenery"

**For Products:**
- "Premium smartphone on marble surface with dramatic lighting"
- "Luxury watch in natural outdoor setting"
- "Artisanal coffee packaging with rustic background"

**For Marketing:**
- "Professional business team collaborating in modern workspace"
- "Customer service representative smiling with headset"
- "Happy family using digital device at home"

### Handling Common Questions

**Q: How long does training take?**
- A: Typically 5-10 minutes for 10-20 images. Quality models may take longer than Fast models.

**Q: How many images do I need for training?**
- A: Minimum 10, recommended 15-20 for best results. More images = better style learning.

**Q: Can I update a trained style?**
- A: Yes, you can add more training images and retrain. The model will improve with additional examples.

**Q: What's the cost?**
- A: Pricing depends on your Exactly.ai plan. Typically per-image generation and per-training-session charges apply.

**Q: Can I use this for existing brand photos?**
- A: Absolutely! Train on your existing product/brand photography to generate new variations that match your visual identity.

**Q: What if generation fails?**
- A: Error messages will display clearly. Common issues: prompt too long, style not ready, API key issues. The module includes comprehensive error handling.

---

## Troubleshooting During Demo

### If Styles Don't Sync:
- Check API key configuration
- Verify network connectivity to Exactly.ai
- Check browser console for errors

### If Training Doesn't Start:
- Ensure at least 10 images are uploaded
- Verify style status is "draft" or "ready" (not already training)
- Check that images were successfully uploaded to Exactly.ai

### If Generation Fails:
- Verify style status is "ready"
- Check prompt isn't empty
- Ensure number of images is between 1-10
- Verify reference images are under 2.5MB if using them

### If Save to DAM Fails:
- Check target folder path exists (create it first if needed)
- Verify user has write permissions to the target folder
- Ensure filename prefix doesn't contain invalid characters

---

## Post-Demo Follow-Up

**Key Takeaways:**
1. Seamless integration with Jahia CMS and Media Manager
2. No external tools needed - everything within Jahia
3. Brand consistency through custom trained models
4. Advanced control with reference images and strength parameters
5. Production-ready with proper error handling and confirmations

**Next Steps for Prospects:**
1. Provide module documentation and installation guide
2. Offer to help with Exactly.ai account setup
3. Schedule training session for their team
4. Discuss use cases specific to their organization
5. Provide pricing information for Exactly.ai credits

