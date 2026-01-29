let currentTicket = {};
let currentUser = {};
let activeAuditType = '';

/**
 * UI Navigation Functions
 */

function updateDashboardUI(auditId) {
    if (auditId && auditId.trim() !== "") {
        const auditUrl = `https://desk.zoho.com/agent/shijigroupintl1712612666536/infrasys-support/ticket-audits/details/${auditId}`;
        const closedCard = document.querySelector(".audit-card[onclick*='closed']");

        if (closedCard) {
            closedCard.style.borderLeft = "5px solid #2f7cf6";
            closedCard.style.background = "#f0f7ff";
            closedCard.innerHTML = `
                <h3 style="color: #1a62d6;">Closed Ticket Audit ✅</h3>
                <p style="font-size: 12px; margin: 5px 0 0 0; color: #555;">
                    Already submitted. <strong>Click to view record</strong>
                </p>
            `;
            closedCard.onclick = function () {
                window.open(auditUrl, '_blank');
            };
        }
    }
}
function openAuditForm(type) {
    activeAuditType = type;

    // Status Logic: Only 'closed' audit requires a Closed ticket
    if (type === 'closed' && currentTicket.status !== 'Closed') {
        document.getElementById('audit-dashboard').classList.add('hidden');
        document.getElementById('message-container').classList.remove('hidden');
        return;
    }

    document.getElementById('audit-dashboard').classList.add('hidden');
    document.getElementById('main-widget-content').classList.remove('hidden');

    // Show only the relevant section group
    document.querySelectorAll('.audit-group').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${type}-audit-sections`).classList.remove('hidden');
}

function goBack() {
    document.getElementById('audit-dashboard').classList.remove('hidden');
    document.getElementById('main-widget-content').classList.add('hidden');
    document.getElementById('message-container').classList.add('hidden');
    document.getElementById('status-msg').innerText = "";
    document.getElementById('audit-form').reset();

    // Hide all reason wrappers and reset textareas
    document.querySelectorAll('.reason-wrapper').forEach(w => {
        w.classList.add('hidden');
        const txt = w.querySelector('textarea');
        if (txt) {
            txt.value = "";
            txt.classList.remove('error-border');
        }
    });
}

/**
 * Original Logic: Handle Multi-line visibility based on "Incorrect"
 */
function updateSectionVisibility() {
    const activeGroup = document.querySelector('.audit-group:not(.hidden)');
    if (!activeGroup) return;

    if (activeAuditType === 'closed') {
        // Section 1: Closing and Other
        toggleReason(['priority-dropdown', 'res-code-dropdown', 'ticket-resolution', 'subject-dropdown'], 'closing-reason-wrapper');

        // Section 2: Customer and Environment
        toggleReason(['contact-info-dropdown', 'account-dropdown', 'reporter-dropdown', 'tenant-dropdown', 'environment-dropdown'], 'customer-reason-wrapper');

        // Section 3: Issue Description and Categories
        toggleReason(['class-dropdown', 'cat-dropdown', 'subcat-dropdown', 'sscat-dropdown', 'ssscat-dropdown'], 'categories-reason-wrapper');
    }
    // Add logic for 'call' or 'priority' audit types here if they use different wrapper IDs
}

/**
 * Updated toggleReason to handle Arrays and Wrapper IDs
 */
function toggleReason(inputIds, wrapperId) {
    const isIncorrect = inputIds.some(id => {
        const el = document.getElementById(id);
        return el && el.value === 'Incorrect';
    });

    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
        if (isIncorrect) {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
            const textarea = wrapper.querySelector('textarea');
            if (textarea) {
                textarea.value = "";
                textarea.classList.remove('error-border');
            }
        }
    }
}

window.onload = function () {
    ZOHODESK.extension.onload().then(function (App) {
        // Fetch User Info
        ZOHODESK.get('user').then(function (userData) {
            if (userData && userData.user) currentUser = userData.user;
        });

        ZOHODESK.get('ticket').then(function (res) {
            if (res.status === 'success') {
                currentTicket = res.ticket;


                currentTicket = res.ticket;
                const existingAuditId = currentTicket.cf ? currentTicket.cf.cf_closed_ticket_audit_id : null;
                // Call the new UI function here
                updateDashboardUI(existingAuditId);
            }
        });

        // Event Listeners for Dropdowns
        document.querySelectorAll('.audit-dropdown').forEach(dropdown => {
            dropdown.addEventListener('change', updateSectionVisibility);
        });

        // Handle Submission
        document.getElementById('submit-audit').onclick = function () {
            const statusMsg = document.getElementById('status-msg');
            let isFormValid = true;

            // 1. Validate ONLY visible dropdowns
            const visibleDropdowns = document.querySelectorAll('.audit-group:not(.hidden) .audit-dropdown');
            visibleDropdowns.forEach(select => {
                // Check if the dropdown itself or its parent (special-dept-fields) is hidden
                const isVisible = select.offsetParent !== null;
                if (isVisible && !select.value) {
                    select.classList.add('error-border');
                    isFormValid = false;
                } else {
                    select.classList.remove('error-border');
                }
            });

            // 2. Validate visible reason wrappers/textareas
            const visibleReasonWrappers = document.querySelectorAll('.audit-group:not(.hidden) .reason-wrapper:not(.hidden)');
            visibleReasonWrappers.forEach(wrapper => {
                const txt = wrapper.querySelector('textarea');
                if (txt && !txt.value.trim()) {
                    txt.classList.add('error-border');
                    isFormValid = false;
                } else if (txt) {
                    txt.classList.remove('error-border');
                }
            });

            if (!isFormValid) {
                statusMsg.innerText = "Please complete all mandatory fields.";
                statusMsg.style.color = "red";
                return;
            }

            // Payload Construction
            const auditData = {
                "name": currentTicket.subject || "No Subject",
                "department": currentTicket.departmentId,
                "layout": "976852000868484970",
                "owner": currentUser.id,
                "cf": {
                    "cf_ticket_number_1": currentTicket.number,
                    "cf_ticket_number": currentTicket.id.toString(),
                    "cf_ticket_owner_name": currentTicket.owner,
                    "cf_priority": document.getElementById('priority-dropdown').value,
                    "cf_resolution_code": document.getElementById('res-code-dropdown').value,
                    "cf_contact_information": document.getElementById('contact-info-dropdown').value,
                    "cf_account": document.getElementById('account-dropdown').value,
                    "cf_picklist_1": document.getElementById('ticket-resolution').value,
                    "cf_ticket_subject": document.getElementById('subject-dropdown').value,
                    "cf_ticket_classification": document.getElementById('class-dropdown').value,
                    "cf_ticket_category": document.getElementById('cat-dropdown').value,
                    "cf_ticket_sub_category": document.getElementById('subcat-dropdown').value,
                    "cf_ticket_sub_sub_category": document.getElementById('sscat-dropdown').value,
                    "cf_ticket_sub_sub_sub_category": document.getElementById('ssscat-dropdown').value,
                    "cf_correct_contact_information": document.getElementById('customer-reason').value,
                    "cf_correct_resolution_code_reason": document.getElementById('categories-reason').value,
                    "cf_correct_priority_reason": document.getElementById('closing-reason').value,


                }
            };

            statusMsg.innerText = "Submitting...";
            statusMsg.style.color = "#666";
            ZOHODESK.request({
                url: 'https://desk.zoho.com/api/v1/cm_ticket_audits',
                type: 'POST',
                postBody: auditData,
                headers: { "orgId": "850352696", "featureFlags": "lookUp" },
                connectionLinkName: "zdesk"
            }).then(function (submitRes) {
                console.log("Raw Response received:", submitRes);

                try {
                    // Step 1: Normalize SDK wrapper
                    const wrapper =
                        submitRes.response ||
                        submitRes.responseText ||
                        submitRes;

                    // Step 2: Ensure wrapper is an object
                    const parsedWrapper =
                        typeof wrapper === "string"
                            ? JSON.parse(wrapper)
                            : wrapper;

                    console.log("Parsed Wrapper:", parsedWrapper);

                    // Step 3: Parse the actual Zoho response payload
                    const payload =
                        typeof parsedWrapper.response === "string"
                            ? JSON.parse(parsedWrapper.response)
                            : parsedWrapper.response;

                    console.log("Parsed Payload:", payload);

                    // 🔑 Correct path
                    const newAuditId = payload?.statusMessage?.id;

                    if (newAuditId) {
                        statusMsg.innerText = "Audit Submitted Successfully!";
                        statusMsg.style.color = "green";

                        updateDashboardUI(newAuditId);
                    } else {
                        console.error("Audit ID not found in payload:", payload);
                    }

                } catch (err) {
                    console.error("Error parsing submit response:", err, submitRes);
                }



                // Go back to dashboard after 2 seconds
                setTimeout(goBack, 2000);

            }).catch(function (error) {
                console.error("Audit Widget: API Submission Error Details:", error);
                statusMsg.innerText = "Submission Error. Check console.";
                statusMsg.style.color = "red";
            });
        };
    });
};