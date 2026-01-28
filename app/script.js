let currentTicket = {};
let currentUser = {};
let activeAuditType = '';

/**
 * UI Navigation Functions
 */
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

        // Fetch Ticket Info
        ZOHODESK.get('ticket').then(function (res) {
            if (res.status === 'success') {
                currentTicket = res.ticket;
                // Auto-show special fields if dept matches
                if (currentTicket.departmentId === "976852000001991044") {
                    const specialFields = document.getElementById('special-dept-fields');
                    if(specialFields) specialFields.classList.remove('hidden');
                }
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
                "name": `${activeAuditType.toUpperCase()} Audit - ${currentTicket.number}`,
                "department": currentTicket.departmentId,
                "owner": currentUser.id,
                "cf": {
                    "cf_ticket_number": currentTicket.id.toString(),
                    "cf_audit_type": activeAuditType,
                    // Map your specific fields for the API here
                    "cf_priority": document.getElementById('priority-dropdown')?.value || "",
                    "cf_closing_comments": document.getElementById('closing-reason')?.value || ""
                }
            };

            statusMsg.innerText = "Submitting...";
            ZOHODESK.request({
                url: 'https://desk.zoho.com/api/v1/cm_ticket_audits',
                type: 'POST',
                postBody: auditData,
                headers: { "orgId": "850352696" },
                connectionLinkName: "zdesk"
            }).then(() => {
                statusMsg.innerText = "Submitted Successfully!";
                statusMsg.style.color = "green";
                setTimeout(goBack, 2000);
            }).catch(() => {
                statusMsg.innerText = "Submission Error.";
                statusMsg.style.color = "red";
            });
        };
    });
};