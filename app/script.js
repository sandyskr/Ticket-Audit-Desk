const getVal = (id) => {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Element with ID "${id}" not found in DOM.`);
        return "";
    }
    return el.value;
};
let currentTicket = {};
let currentUser = {};
let activeAuditType = '';

const AUDIT_SETTINGS = {
    'closed': {
        "layout": "976852000868484970",
        getFieldData: () => ({
            "cf_priority": getVal('priority-dropdown'),
            "cf_resolution_code": getVal('res-code-dropdown'),
            "cf_contact_information": getVal('contact-info-dropdown'),
            "cf_account": getVal('account-dropdown'),
            "cf_picklist_1": getVal('ticket-resolution'),
            "cf_ticket_subject": getVal('subject-dropdown'),
            "cf_ticket_classification": getVal('class-dropdown'),
            "cf_ticket_category": getVal('cat-dropdown'),
            "cf_ticket_sub_category": getVal('subcat-dropdown'),
            "cf_ticket_sub_sub_category": getVal('sscat-dropdown'),
            "cf_ticket_sub_sub_sub_category": getVal('ssscat-dropdown'),
            "cf_correct_contact_information": getVal('customer-reason'),
            "cf_correct_resolution_code_reason": getVal('categories-reason'),
            "cf_correct_priority_reason": getVal('closing-reason'),
        })
    },
    'call': {
        "layout": "976852000868866943",
        getFieldData: () => ({
            "cf_customer_information_and_issue_details": getVal('ca-gather-info'),
            "cf_speak_in_friendly_polite_and_professional_tone": getVal('ca-tone'),
            "cf_narrow_scope_of_call": getVal('ca-scope'),
            "cf_actively_listen_to_the_customer_control_call_pace": getVal('ca-listen'),
            "cf_greet_customer_and_identify_self_and_product": getVal('ca-greet'),
            "cf_follow_proper_hold_procedures": getVal('ca-hold'),
            "cf_comments_customer_service": getVal('ca-service-reason'),
            "cf_policies_and_procedures": getVal('ca-policy'),
            "cf_demonstrate_knowledge_of_product": getVal('ca-prod-knowledge'),
            "cf_accurate_and_complete_information": getVal('ca-accuracy'),
            "cf_use_available_resources": getVal('ca-resources'),
            "cf_comments_process_knowledge": getVal('ca-process-reason'),
            "cf_document_call_and_next_steps_in_zoho_desk": getVal('ca-doc'),
            "cf_confirm_customer_needs_were_met": getVal('ca-confirm'),
            "cf_close_on_positive_note": getVal('ca-close-note'),
            "cf_correct_priority_reason": getVal('ca-closing-reason'),
        })
    }
};

function updateDashboardUI(auditId, type) {
    if (auditId && auditId.trim() !== "") {
        const auditUrl = `https://desk.zoho.com/agent/shijigroupintl1712612666536/infrasys-support/ticket-audits/details/${auditId}`;
        
        // Find the specific card based on the type passed (closed or call)
        const targetCard = document.querySelector(`.audit-card[onclick*='${type}']`);

        if (targetCard) {
            targetCard.style.borderLeft = "5px solid #2f7cf6";
            targetCard.style.background = "#f0f7ff";
            targetCard.innerHTML = `
                <h3 style="color: #1a62d6;">${type === 'closed' ? 'Closed Ticket' : 'Phone Call'} Audit ✅</h3>
                <p style="font-size: 12px; margin: 5px 0 0 0; color: #555;">
                    Already submitted. <strong>Click to view record</strong>
                </p>
            `;
            // Redirect the click behavior to open the existing audit
            targetCard.onclick = function (e) {
                e.stopPropagation(); // Prevent any default form opening logic
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
    document.querySelectorAll('.audit-group').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${type}-audit-sections`).classList.remove('hidden');
}

function goBack() {
    document.getElementById('audit-dashboard').classList.remove('hidden');
    document.getElementById('main-widget-content').classList.add('hidden');
    document.getElementById('message-container').classList.add('hidden');
    document.getElementById('status-msg').innerText = "";
    document.getElementById('audit-form').reset();
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
        toggleReason(['priority-dropdown', 'res-code-dropdown', 'ticket-resolution', 'subject-dropdown'], 'closing-reason-wrapper');
        toggleReason(['contact-info-dropdown', 'account-dropdown'], 'customer-reason-wrapper');
        toggleReason(['class-dropdown', 'cat-dropdown', 'subcat-dropdown', 'sscat-dropdown', 'ssscat-dropdown'], 'categories-reason-wrapper');
    }

    // NEW: Logic for Call Audit
    else if (activeAuditType === 'call') {
        // Customer Service Section
        toggleReason(['ca-gather-info', 'ca-tone', 'ca-scope', 'ca-listen', 'ca-greet', 'ca-hold'], 'ca-service-reason-wrapper');
        // Process Knowledge Section
        toggleReason(['ca-policy', 'ca-prod-knowledge', 'ca-accuracy', 'ca-resources'], 'ca-process-reason-wrapper');
        // Closing Section
        toggleReason(['ca-doc', 'ca-confirm', 'ca-close-note'], 'ca-closing-reason-wrapper');
    }
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
                const closedCard = document.querySelector(".audit-card[onclick*='closed']");
        if (closedCard) {
            if (currentTicket.status === 'Closed') {
                closedCard.classList.remove('hidden'); // Show if closed
            } else {
                closedCard.classList.add('hidden');    // Hide if not closed
            }
        }
                const closedAuditId = currentTicket.cf ? currentTicket.cf.cf_closed_ticket_audit_id : null;
                const callAuditId = currentTicket.cf ? currentTicket.cf.cf_call_audit_id : null;

                // Update dashboard status for both independently
                if (closedAuditId && closedAuditId !== "") {
                    updateDashboardUI(closedAuditId, 'closed');
                }
                if (callAuditId && callAuditId !== "") {
                    updateDashboardUI(callAuditId, 'call');
                }
            }
        });

        // Event Listeners for Dropdowns
        document.querySelectorAll('.audit-dropdown').forEach(dropdown => {
            dropdown.addEventListener('change', updateSectionVisibility);
        });

        // Handle Submission
        document.getElementById('submit-audit').onclick = function () {
            const submitBtn = document.getElementById('submit-audit');
            const statusMsg = document.getElementById('status-msg');
            const settings = AUDIT_SETTINGS[activeAuditType];
            if (!settings) return;
            if (submitBtn.disabled) return;
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
            submitBtn.disabled = true;
            submitBtn.innerText = "Processing...";
            submitBtn.style.backgroundColor = "#ccc"; // Grey out the button
            submitBtn.style.cursor = "not-allowed";
            // Payload Construction
            const auditData = {
                "name": currentTicket.subject || "No Subject",
                "department": currentTicket.departmentId,
                "owner": currentUser.id,
                "layout": settings.layout,
                "cf": {
                    "cf_ticket_number_1": currentTicket.number,
                    "cf_ticket_number": currentTicket.id.toString(),
                    "cf_ticket_owner_name": currentTicket.owner,
                    ...settings.getFieldData()


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

                        updateDashboardUI(newAuditId, activeAuditType)
                    } else {
                        console.error("Audit ID not found in payload:", payload);
                    }

                } catch (err) {
                    console.error("Error parsing submit response:", err, submitRes);
                }

                setTimeout(goBack, 2000);

            }).catch(function (error) {
                console.error("Audit Widget: API Submission Error Details:", error);
                statusMsg.innerText = "Submission Error. Check console.";
                statusMsg.style.color = "red";

                submitBtn.disabled = false;
                submitBtn.innerText = "Submit Audit";
                submitBtn.style.backgroundColor = "#2f7cf6";
                submitBtn.style.cursor = "pointer";
            });
        };
    });
};