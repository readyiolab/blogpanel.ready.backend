const nodemailer = require('nodemailer');
const db = require('../config/db');

// Readyio content aligned with https://readyio.com/
const READYIO_CONTEXT = `
You are a helpful and professional AI assistant for Readyio (readyio.com).
Your goal is to answer questions based on the information below and present Readyio's services in a visually appealing, clean, and structured way using Emojis and bullet points.

Important Guidelines:
- DO NOT use markdown bold asterisks (do NOT use **). Use clean headers with emojis instead.
- Keep the layout clean with bullet points and adequate spacing so the customer understands effectively.
- If the user wants to book a call or consultation, ask for their name and email only.
- Website: https://readyio.com | Email: hello@readyio.com

---

About Readyio:
Tagline: Websites, CRM and AI solutions that help businesses grow.
Readyio builds high-performing websites, practical web applications, customized CRM systems and AI automation—all through one accountable technology team.
Technology shaped around the business—not the other way around.

Why Readyio:
• Business-first thinking — goals, customers and workflows before technology
• One accountable team — website, CRM and automation stay connected
• Clear scope and communication — defined deliverables and realistic milestones
• Support beyond launch — maintain and improve as the business grows

---

What We Build (Attract • Organize • Automate):

01 ATTRACT — Websites & Web Applications
Modern websites that convert visitors into customers.
• Business and lead-generation websites
• E-commerce and customer portals
• Custom web applications

02 ORGANIZE — CRM & Business Systems
Keep every lead, customer and follow-up organized.
• CRM setup and customization
• Lead and customer management
• Workflow integrations and dashboards

03 AUTOMATE — AI & Automation
Reduce repetitive work and respond to customers faster.
• AI chat and voice assistants
• Lead and customer-support automation
• Document, data and reporting workflows

---

For Founders — From idea to working product:
1. Idea — Validate the problem and define the solution
2. First version — Build the right first version and test with real users
3. Launch — Launch, learn and keep improving

Selected work examples: iGrowBig (distributor enablement SaaS), Arbilo (crypto arbitrage intelligence), Freedom M&A (AI-powered engagement), plus business websites for brands like Empower Life, Shina Kaur and Cedento.

Delivery process: Understand → Build → Launch & Support

---

Booking:
If the user wants to book a call, ask for their name and email.
They can also book a 30-min call or discuss a project via readyio.com/contact.

Keep responses concise, helpful, and focused on Readyio's services. If asked about pricing, suggest they book a call to discuss their specific needs.
`;

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Email transporter configuration
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

// Rule-based fallback AI response generator
const generateFallbackAiResponse = (userMessage) => {
    const lower = userMessage.toLowerCase();
    
    if (lower.includes("founder") || lower.includes("mvp") || lower.includes("startup") || lower.includes("idea")) {
        return "🚀 Readyio For Founders:\n\nWe help founders go from idea to a working product without unnecessary complexity.\n\n• Idea — validate the problem and define the solution\n• First version — build and test with real users\n• Launch — ship, learn and keep improving\n\nWant to discuss your idea? Share your name and email and we'll follow up.";
    }

    if (lower.includes("web") || lower.includes("website") || lower.includes("app") || lower.includes("portal") || lower.includes("attract")) {
        return "🌐 Readyio Websites & Web Applications:\n\nModern websites and apps that convert visitors into customers.\n\n• Business and lead-generation websites\n• E-commerce and customer portals\n• Custom web applications\n\nWould you like to see our work or discuss your project?";
    }
    
    if (lower.includes("crm") || lower.includes("lead") || lower.includes("pipeline") || lower.includes("organize") || lower.includes("erp")) {
        return "📊 Readyio CRM & Business Systems:\n\nSimple CRM and business systems customized around how your team actually works.\n\n• CRM setup and customization\n• Lead and customer management\n• Workflow integrations and dashboards\n\nWould you like to explore a custom CRM for your team?";
    }

    if (lower.includes("ai") || lower.includes("automation") || lower.includes("agent") || lower.includes("bot") || lower.includes("automate")) {
        return "⚡ Readyio AI & Automation:\n\nPractical AI assistants and automations that reduce repetitive work.\n\n• AI chat and voice assistants\n• Lead and customer-support automation\n• Document, data and reporting workflows\n\nWould you like to book a call to discuss your automation goals?";
    }

    if (lower.includes("price") || lower.includes("cost") || lower.includes("budget") || lower.includes("timeline")) {
        return "💰 Pricing & Project Timelines:\n\nEvery Readyio project has clear scope, realistic milestones and transparent delivery. Typical first versions launch in weeks, not months.\n\nShare your name and email for a consultation, or visit https://readyio.com/contact.";
    }

    return "Hi! 👋 Readyio builds websites, CRM systems and practical AI automation for growing businesses and founders.\n\nAsk about Websites & Apps, CRM Systems, AI Automation, or For Founders — or share your name and email to discuss your project.";
};

// Chat with AI
const chat = async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const bookingIntent = detectBookingIntent(message);

        // Read API Key dynamically
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || apiKey.includes('YOUR_KEY')) {
            return res.status(200).json({
                message: generateFallbackAiResponse(message),
                bookingIntent: bookingIntent
            });
        }

        // Build messages array with context
        const messages = [
            { role: 'system', content: READYIO_CONTEXT },
            ...conversationHistory,
            { role: 'user', content: message }
        ];

        try {
            // Call OpenRouter API
            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://readyio.com',
                    'X-Title': 'Readyio'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4o-mini',
                    messages: messages,
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            if (response.ok) {
                const data = await response.json();
                const aiResponse = data.choices[0]?.message?.content || generateFallbackAiResponse(message);
                return res.status(200).json({
                    message: aiResponse,
                    bookingIntent: bookingIntent
                });
            } else {
                console.warn('[Backend Notice] OpenRouter API key unverified or unauthorized (401). Using Readyio Assistant engine.');
            }
        } catch (apiErr) {
            console.warn('[Backend Notice] OpenRouter API fetch exception, using Readyio Assistant engine:', apiErr.message);
        }

        // Return structured AI response on API error/401
        return res.status(200).json({
            message: generateFallbackAiResponse(message),
            bookingIntent: bookingIntent
        });

    } catch (error) {
        console.error('Error in chat:', error);
        return res.status(200).json({
            message: "Thanks for reaching out! We build web apps, custom CRMs, and AI automation tailored to your business needs.",
            bookingIntent: false
        });
    }
};

// Detect booking intent
const detectBookingIntent = (message) => {
    const bookingKeywords = [
        'book', 'schedule', 'call', 'consultation', 'meeting',
        'appointment', 'talk', 'discuss', 'connect', 'get started',
        'start a project', 'hire', 'work with you'
    ];
    const lowerMessage = message.toLowerCase();
    return bookingKeywords.some(keyword => lowerMessage.includes(keyword));
};

// Handle booking submission
const submitBooking = async (req, res) => {
    try {
        const { name, email, phone, note, service } = req.body;

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required fields' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        console.log('[Backend Lead Captured] New Chatbot Lead:', {
            name,
            email,
            phone: phone || 'N/A',
            note: note || service || 'Chatbot Inquiry',
            timestamp: new Date().toISOString()
        });

        // Save to database
        let dbSaved = false;
        try {
            await db.insert('tbl_chatbot_bookings', {
                name,
                email,
                created_at: new Date()
            });

            // Also insert into contact messages for central lead tracking
            await db.insert('tbl_contact_messages', {
                name,
                email,
                country: phone || null,
                service: service || 'AI Chatbot Consultation',
                message: note || 'Lead captured via Readyio AI Chatbot'
            });
            dbSaved = true;
        } catch (dbError) {
            console.warn('[Backend Warning] DB save error (continuing lead flow):', dbError.message);
        }

        // Send confirmation email to user and admin notification
        let emailSent = false;
        try {
            if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_USER !== 'your-email@gmail.com') {
                const transporter = createTransporter();

                // User confirmation email
                const userMailOptions = {
                    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
                    to: email,
                    subject: 'Thanks for reaching out to Readyio! 🚀',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
                            <h2 style="color: #6C5CE7; margin-top: 0;">Hi ${name}!</h2>
                            <p>Thank you for connecting with Readyio. We've received your request for a project consultation.</p>
                            <p>Our engineering & product team is reviewing your requirements and will reach out to you within 24 hours.</p>
                            <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; margin: 20px 0;">
                                <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Submitted Email:</strong> ${email}</p>
                                ${phone ? `<p style="margin: 6px 0 0 0; font-size: 14px; color: #475569;"><strong>Phone:</strong> ${phone}</p>` : ''}
                            </div>
                            <p>Explore our latest client builds and solutions at <a href="https://readyio.com" style="color: #6C5CE7; font-weight: bold;">readyio.com</a>.</p>
                            <br>
                            <p style="margin: 0; color: #64748b; font-size: 13px;">Best regards,<br><strong>The Readyio Team</strong></p>
                        </div>
                    `
                };

                await transporter.sendMail(userMailOptions);
                emailSent = true;

                // Admin notification email
                const adminEmail = process.env.LEAD_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'hello@readyio.com';
                const adminMailOptions = {
                    from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
                    to: adminEmail,
                    subject: `🔥 New Chatbot Lead: ${name}`,
                    html: `
                        <h3>New Lead Captured via AI Chatbot</h3>
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
                        <p><strong>Note/Service:</strong> ${note || service || 'General Consultation'}</p>
                    `
                };
                await transporter.sendMail(adminMailOptions).catch(err => console.warn('Admin notification email warning:', err.message));
            }
        } catch (emailError) {
            console.warn('Email sending warning:', emailError.message);
        }

        return res.status(200).json({
            success: true,
            message: `Thank you ${name}! Your consultation request is received. Check ${email} for confirmation.`,
            dbSaved,
            emailSent
        });

    } catch (error) {
        console.error('Error in booking:', error);
        return res.status(200).json({
            success: true,
            message: 'Thank you! Your request has been recorded. Our team will contact you shortly.'
        });
    }
};

module.exports = { chat, submitBooking };
