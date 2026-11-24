
require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/", rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false
}));

// Opportunity categories and example source websites.
// These are search targets, not claims of API partnerships.

const SOURCES = {
    scholarships: {
        label: "Scholarships",
        keywords: "scholarship student financial aid grant",
        sites: [
            "scholarships.gov.in",
            "buddy4study.com",
            "vidyasaarathi.co.in",
            "aicte-india.org",
            "unstop.com"
        ],
        portals: [
            {
                name: "National Scholarship Portal",
                url: "https://scholarships.gov.in/"
            },
            {
                name: "Buddy4Study",
                url: "https://www.buddy4study.com/"
            },
            {
                name: "Vidyasaarathi",
                url: "https://www.vidyasaarathi.co.in/"
            }
        ]
    },

    internships: {
        label: "Internships",
        keywords: "internship student trainee summer internship",
        sites: [
            "internshala.com",
            "unstop.com",
            "wellfound.com",
            "letsintern.com",
            "linkedin.com"
        ],
        portals: [
            {
                name: "Internshala",
                url: "https://internshala.com/"
            },
            {
                name: "Unstop",
                url: "https://unstop.com/"
            },
            {
                name: "LinkedIn Internships",
                url: "https://www.linkedin.com/jobs/"
            }
        ]
    },

    jobs: {
        label: "Jobs",
        keywords: "entry level graduate fresher jobs hiring",
        sites: [
            "ncs.gov.in",
            "naukri.com",
            "in.indeed.com",
            "linkedin.com",
            "wellfound.com"
        ],
        portals: [
            {
                name: "National Career Service",
                url: "https://www.ncs.gov.in/"
            },
            {
                name: "Naukri",
                url: "https://www.naukri.com/"
            },
            {
                name: "Indeed India",
                url: "https://in.indeed.com/"
            }
        ]
    },

    admissions: {
        label: "College Admissions",
        keywords: "college university admission application engineering",
        sites: [
            "nta.ac.in",
            "josaa.nic.in",
            "cetonline.karnataka.gov.in",
            "aicte-india.org",
            "education.gov.in"
        ],
        portals: [
            {
                name: "National Testing Agency",
                url: "https://www.nta.ac.in/"
            },
            {
                name: "JoSAA",
                url: "https://josaa.nic.in/"
            },
            {
                name: "Karnataka Examinations Authority",
                url: "https://cetonline.karnataka.gov.in/"
            }
        ]
    },

    apprenticeships: {
        label: "Apprenticeships",
        keywords: "apprenticeship trainee graduate training",
        sites: [
            "apprenticeshipindia.gov.in",
            "nats.education.gov.in",
            "ncs.gov.in",
            "linkedin.com"
        ],
        portals: [
            {
                name: "Apprenticeship India",
                url: "https://www.apprenticeshipindia.gov.in/"
            },
            {
                name: "NATS",
                url: "https://nats.education.gov.in/"
            }
        ]
    },

    competitions: {
        label: "Competitions and Hackathons",
        keywords: "student hackathon innovation competition challenge",
        sites: [
            "unstop.com",
            "devfolio.co",
            "hack2skill.com",
            "devpost.com"
        ],
        portals: [
            {
                name: "Unstop",
                url: "https://unstop.com/"
            },
            {
                name: "Devfolio",
                url: "https://devfolio.co/"
            },
            {
                name: "Hack2Skill",
                url: "https://hack2skill.com/"
            }
        ]
    },

    fellowships: {
        label: "Fellowships",
        keywords: "student fellowship research fellowship programme",
        sites: [
            "india.gov.in",
            "unstop.com",
            "buddy4study.com",
            "wellfound.com"
        ],
        portals: [
            {
                name: "India Government Services",
                url: "https://www.india.gov.in/"
            },
            {
                name: "Unstop",
                url: "https://unstop.com/"
            }
        ]
    }
};

// Clean user input before constructing a search query.

function clean(value, maxLength = 100) {
    return String(value || "")
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

// Basic relevance scoring.
// A score is an estimate, not an eligibility decision.

function calculateMatch(result, profile) {
    const text = (
        result.title + " " + result.snippet
    ).toLowerCase();

    let score = 0;
    const reasons = [];

    const course = clean(profile.course).toLowerCase();
    const location = clean(profile.location).toLowerCase();

    const skills = clean(profile.skills)
        .toLowerCase()
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

    if (course && text.includes(course)) {
        score += 30;
        reasons.push("Course mentioned");
    }

    if (location && text.includes(location)) {
        score += 20;
        reasons.push("Location mentioned");
    }

    const matchedSkills = skills.filter(skill =>
        text.includes(skill)
    );

    if (matchedSkills.length) {
        score += Math.min(30, matchedSkills.length * 10);
        reasons.push("Skills mentioned: " + matchedSkills.join(", "));
    }

    const education = clean(profile.education).toLowerCase();

    if (education && text.includes(education)) {
        score += 10;
        reasons.push("Education mentioned");
    }

    const semester = clean(profile.semester).toLowerCase();

    if (semester && text.includes(semester)) {
        score += 10;
        reasons.push("Study level mentioned");
    }

    return {
        score: Math.min(score, 100),
        reasons
    };
}

// Search through SerpAPI.

async function searchWeb(query) {
    const apiKey = process.env.SERPAPI_KEY;

    if (!apiKey || apiKey === "PASTE_YOUR_SERPAPI_KEY_HERE") {
        throw new Error("Search API key is not configured.");
    }

    const params = new URLSearchParams({
        engine: "google",
        q: query,
        api_key: apiKey,
        google_domain: "google.co.in",
        gl: "in",
        hl: "en",
        num: "20"
    });

    const response = await fetch(
        "https://serpapi.com/search.json?" + params.toString()
    );

    if (!response.ok) {
        throw new Error("Search provider returned an error.");
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error);
    }

    return data.organic_results || [];
}

// Main opportunity search endpoint.

app.get("/api/opportunities", async (req, res) => {
    try {
        const category = clean(req.query.category || "all").toLowerCase();

        const keyword = clean(req.query.keyword, 100);
        const profile = {
            course: clean(req.query.course),
            location: clean(req.query.location),
            skills: clean(req.query.skills),
            education: clean(req.query.education),
            semester: clean(req.query.semester)
        };

        let categories;

        if (category === "all") {
            categories = Object.keys(SOURCES);
        } else if (SOURCES[category]) {
            categories = [category];
        } else {
            return res.status(400).json({
                error: "Unknown opportunity category."
            });
        }

        const allResults = [];
        const portalLinks = [];

        for (const key of categories) {
            const config = SOURCES[key];

            portalLinks.push(...config.portals);

            const siteQuery = config.sites
                .map(site => "site:" + site)
                .join(" OR ");

            const terms = [
                config.keywords,
                keyword,
                profile.course,
                profile.location,
                profile.skills,
                profile.education,
                siteQuery
            ].filter(Boolean);

            const query = terms.join(" ");

            try {
                const results = await searchWeb(query);

                results.forEach(result => {
                    if (!result.link || !result.title) return;

                    const match = calculateMatch({
                        title: result.title || "",
                        snippet: result.snippet || ""
                    }, profile);

                    allResults.push({
                        id: result.link,
                        title: result.title,
                        description: result.snippet || "Open the source website to view details.",
                        url: result.link,
                        source: result.source || new URL(result.link).hostname,
                        category: config.label,
                        matchScore: match.score,
                        matchReasons: match.reasons,
                        verified: false
                    });
                });

            } catch (error) {
                console.error("Search failed for", key, error.message);
            }
        }

        // Remove duplicate links.

        const unique = Array.from(
            new Map(allResults.map(item => [item.url, item])).values()
        );

        // Sort by match score, but DO NOT hide low-scoring results.

        unique.sort((a, b) => b.matchScore - a.matchScore);

        res.json({
            success: true,
            count: unique.length,
            results: unique,
            portals: Array.from(
                new Map(portalLinks.map(p => [p.url, p])).values()
            ),
            message: unique.length
                ? "Search results found. Check each source for current eligibility and deadlines."
                : "No indexed results were returned. Try broader keywords or visit the official portals.",
            notice: "Search results are not verified applications. Check the original website before applying."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message || "Unable to search right now."
        });
    }
});

// API health check.

app.get("/api/health", (req, res) => {
    res.json({
        status: "FormPilot server is running"
    });
});

app.listen(PORT, () => {
    console.log("FormPilot running at http://localhost:" + PORT);
});
