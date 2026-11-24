

let selectedOpportunity = null;

function getProfile() {
    return JSON.parse(
        localStorage.getItem("formPilotProfile") || "null"
    );
}

function saveProfile() {
    const profile = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        location: document.getElementById("location").value.trim(),
        education: document.getElementById("education").value,
        course: document.getElementById("course").value.trim(),
        semester: document.getElementById("semester").value.trim(),
        skills: document.getElementById("skills").value.trim(),
        interests: document.getElementById("interests").value.trim(),
        cgpa: document.getElementById("cgpa").value.trim()
    };

    if (!profile.name || !profile.email || !profile.course) {
        alert("Please enter your name, email and course.");
        return;
    }

    if (!document.getElementById("email").checkValidity()) {
        alert("Enter a valid email address.");
        return;
    }

    localStorage.setItem(
        "formPilotProfile",
        JSON.stringify(profile)
    );

    document.getElementById("profileMessage").textContent =
        "Your profile has been saved successfully.";

    document.getElementById("profileMessage").className =
        "message";
}

function loadProfile() {
    const profile = getProfile();
    if (!profile) return;

    Object.keys(profile).forEach(function(key) {
        const element = document.getElementById(key);

        if (element) {
            element.value = profile[key] || "";
        }
    });
}

function showSection(id) {
    document.querySelectorAll(".section").forEach(function(section) {
        section.classList.add("hidden");
    });

    document.getElementById(id).classList.remove("hidden");

    if (id === "applications") {
        showApplications();
    }
}

async function searchOpportunities() {
    const profile = getProfile();

    if (!profile) {
        alert("Please create and save your profile first.");
        showSection("profile");
        return;
    }

    const category = document.getElementById("category").value;
    const keyword = document.getElementById("keyword").value.trim();

    const message = document.getElementById("searchMessage");
    const resultsContainer = document.getElementById("results");
    const portalsContainer = document.getElementById("portals");
    const button = document.getElementById("searchButton");

    resultsContainer.replaceChildren();
    portalsContainer.replaceChildren();

    message.textContent = "Searching opportunity sources...";
    button.disabled = true;
    button.textContent = "Searching...";

    const params = new URLSearchParams({
        category: category,
        keyword: keyword,
        course: profile.course,
        location: profile.location,
        skills: profile.skills,
        education: profile.education,
        semester: profile.semester
    });

    try {
        const response = await fetch(
            "/api/opportunities?" + params.toString()
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Search failed.");
        }

        message.textContent =
            data.message + " " + data.notice;

        if (!data.results.length) {
            const empty = document.createElement("div");
            empty.className = "panel";
            empty.textContent =
                "No indexed results were returned for this search. " +
                "Try a broader keyword or use the official portals below.";
            resultsContainer.appendChild(empty);
        }

        data.results.forEach(function(item) {
            resultsContainer.appendChild(createOpportunityCard(item));
        });

        data.portals.forEach(function(portal) {
            const card = document.createElement("div");
            card.className = "portal";

            const link = document.createElement("a");
            link.href = portal.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = portal.name;

            card.appendChild(link);
            portalsContainer.appendChild(card);
        });

    } catch (error) {
        message.textContent =
            "Search could not be completed: " + error.message +
            " Please check the server and API configuration.";

    } finally {
        button.disabled = false;
        button.textContent = "Search Opportunities";
    }
}

function createOpportunityCard(item) {
    const card = document.createElement("article");
    card.className = "opportunity";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const category = document.createElement("p");
    category.textContent = "Category: " + item.category;

    const description = document.createElement("p");
    description.textContent = item.description;

    const source = document.createElement("p");
    source.textContent = "Source: " + item.source;

    const score = document.createElement("span");
    score.className = "match";
    score.textContent = "Profile relevance: " + item.matchScore + "%";

    const reasons = document.createElement("p");
    reasons.textContent = item.matchReasons.length
        ? "Why it matched: " + item.matchReasons.join("; ")
        : "No profile terms were detected in the search snippet. " +
          "You can still open and check this opportunity.";

    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View original listing";

    const applyButton = document.createElement("button");
    applyButton.textContent = "Review & Continue";
    applyButton.addEventListener("click", function() {
        selectOpportunity(item);
    });

    card.append(
        title,
        category,
        description,
        source,
        score,
        reasons,
        link,
        applyButton
    );

    return card;
}

function selectOpportunity(item) {
    selectedOpportunity = item;

    const profile = getProfile();

    document.getElementById("reviewTitle").textContent =
        item.title;

    const details = document.getElementById("reviewDetails");
    details.replaceChildren();

    const rows = [
        ["Name", profile.name],
        ["Email", profile.email],
        ["Phone", profile.phone],
        ["Education", profile.education],
        ["Course", profile.course],
        ["Location", profile.location]
    ];

    rows.forEach(function(row) {
        const p = document.createElement("p");
        p.textContent = row[0] + ": " + (row[1] || "Not provided");
        details.appendChild(p);
    });

    document.getElementById("reviewCheckbox").checked = false;
    document.getElementById("reviewMessage").textContent = "";

    showSection("review");
}

function confirmAndContinue() {
    if (!selectedOpportunity) {
        alert("Please select an opportunity first.");
        return;
    }

    const checked =
        document.getElementById("reviewCheckbox").checked;

    if (!checked) {
        alert("Please confirm that you reviewed your details.");
        return;
    }

    // Only allow normal HTTP/HTTPS application links.

    let url;

    try {
        url = new URL(selectedOpportunity.url);

        if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Invalid link");
        }
    } catch {
        alert("This application link is not valid.");
        return;
    }

    const applications = JSON.parse(
        localStorage.getItem("formPilotApplications") || "[]"
    );

    applications.push({
        title: selectedOpportunity.title,
        category: selectedOpportunity.category,
        url: url.href,
        selectedAt: new Date().toISOString(),
        status: "User chose to continue"
    });

    localStorage.setItem(
        "formPilotApplications",
        JSON.stringify(applications)
    );

    // Open the official application website.
    window.open(url.href, "_blank", "noopener,noreferrer");

    document.getElementById("reviewMessage").textContent =
        "Your choice has been saved. Complete the application on the official website.";

    showSection("applications");
}

function showApplications() {
    const applications = JSON.parse(
        localStorage.getItem("formPilotApplications") || "[]"
    );

    const container = document.getElementById("applicationList");
    container.replaceChildren();

    if (!applications.length) {
        container.textContent =
            "You have not selected any opportunities yet.";
        return;
    }

    applications.forEach(function(app) {
        const card = document.createElement("div");
        card.className = "opportunity";

        const title = document.createElement("h3");
        title.textContent = app.title;

        const category = document.createElement("p");
        category.textContent = "Category: " + app.category;

        const status = document.createElement("p");
        status.textContent = "Status: " + app.status;

        const link = document.createElement("a");
        link.href = app.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Open original website";

        card.append(title, category, status, link);
        container.appendChild(card);
    });
}

loadProfile();
