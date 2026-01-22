let currentTicket = {};
let currentUser = {};

// Helper to handle conditional visibility
function toggleReasonField(dropdownId, wrapperId, triggerValues) {
    const dropdown = document.getElementById(dropdownId);
    const wrapper = document.getElementById(wrapperId);
    const textarea = wrapper.querySelector('textarea');

    if (triggerValues.includes(dropdown.value)) {
        wrapper.classList.remove('hidden');
    } else {
        wrapper.classList.add('hidden');
        textarea.value = ""; // Clear value if hidden
        textarea.classList.remove('error-border');
    }
}

window.onload = function () {
    console.clear();
    console.log("Audit Widget: Window Loaded. Initializing SDK...");

    ZOHODESK.extension.onload().then(function (App) {
        console.log("Audit Widget: SDK Handshake Successful.", App);

        // 1. Fetch User Info
        ZOHODESK.get('user').then(function (userData) {
            console.log("Audit Widget: Raw User Data Received:", userData);
            if (userData && userData.user) {
                currentUser = userData.user;
                console.log("Audit Widget: User context set:", currentUser.name, "(ID:", currentUser.id + ")");
            } else {
                console.warn("Audit Widget: User data structure unexpected.");
            }
        }).catch(function (err) {
            console.error("Audit Widget: Error fetching user info:", err);
        });

        // 2. Fetch Ticket Info
        ZOHODESK.get('ticket').then(function (res) {
            console.log("Audit Widget: Raw Ticket Response:", res);

            if (res.status === 'success') {
                currentTicket = res.ticket;
                console.log("Audit Widget: Ticket Context Loaded. Status:", currentTicket.status, "ID:", currentTicket.id);
                console.log("Audit Widget: Ticket Context Loaded. Dept ID:", currentTicket.departmentId);
                const mainContent = document.getElementById('main-widget-content');
                const msgContainer = document.getElementById('message-container');
                const deptFields = document.getElementById('department-specific-fields');

                if (currentTicket.status === 'Closed') {
                    console.log("Audit Widget: Ticket is Closed. Displaying form.");
                    mainContent.classList.remove('hidden');
                    msgContainer.classList.add('hidden');
                    if (currentTicket.departmentId === "976852000001991044") {
                        console.log("Audit Widget: Special department detected. Showing extra fields.");
                        deptFields.classList.remove('hidden');
                    } else {
                        deptFields.classList.add('hidden');
                    }
                } else {
                    console.log("Audit Widget: Ticket is NOT Closed. Showing restriction message.");
                    mainContent.classList.add('hidden');
                    msgContainer.classList.remove('hidden');
                }
            } else {
                console.error("Audit Widget: Ticket fetch failed with status:", res.status);
            }
        }).catch(function (err) {
            console.error("Audit Widget: Exception during ZOHODESK.get('ticket'):", err);
        });

        // Add Event Listeners for Dynamic UI
        document.getElementById('priority-dropdown').addEventListener('change', function () {
            toggleReasonField('priority-dropdown', 'priority-reason-wrapper', ['Incorrect']);
        });
        document.getElementById('res-code-dropdown').addEventListener('change', function () {
            toggleReasonField('res-code-dropdown', 'res-reason-wrapper', ['Incorrect']);
        });
        document.getElementById('contact-info-dropdown').addEventListener('change', function () {
            toggleReasonField('contact-info-dropdown', 'contact-info-reason-wrapper', ['Incorrect', 'Not Complete']);
        });

        // 3. Handle Form Submission
        document.getElementById('submit-audit').onclick = function () {
            console.log("Audit Widget: Submit Button Clicked.");
            const statusMsg = document.getElementById('status-msg');

            // Define logic for which fields are mandatory based on visibility
            const fieldsToValidate = [
                'priority-dropdown',
                'res-code-dropdown',
                'contact-info-dropdown'
            ];

            // Only add reason fields to validation if their wrapper is visible
            if (!document.getElementById('priority-reason-wrapper').classList.contains('hidden')) fieldsToValidate.push('priority-reason');
            if (!document.getElementById('res-reason-wrapper').classList.contains('hidden')) fieldsToValidate.push('res-reason');
            if (!document.getElementById('contact-info-reason-wrapper').classList.contains('hidden')) fieldsToValidate.push('contact-info-reason');

            const isSpecialDept = !document.getElementById('department-specific-fields').classList.contains('hidden');
            if (isSpecialDept) {
                fieldsToValidate.push('tenant-dropdown', 'reporter-dropdown', 'environment-dropdown');
            }

            let isFormValid = true;
            let firstErrorField = null;

            // Validate only the relevant fields
            fieldsToValidate.forEach(id => {
                const el = document.getElementById(id);
                if (!el.value.trim()) {
                    el.classList.add('error-border', 'shake');
                    isFormValid = false;
                    if (!firstErrorField) firstErrorField = el;
                    setTimeout(() => el.classList.remove('shake'), 400);
                } else {
                    el.classList.remove('error-border');
                }
            });

            if (!isFormValid) {
                console.warn("Audit Widget: Form validation failed.");
                statusMsg.innerText = "All visible fields are mandatory.";
                statusMsg.style.color = "#e53935";
                if (firstErrorField) firstErrorField.focus();
                return;
            }

            const auditData = {
                "name": currentTicket.subject || "No Subject",
                "department": currentTicket.departmentId,
                "owner": currentUser.id,
                "cf": {
                    "cf_ticket_number_1": currentTicket.number,
                    "cf_ticket_owner_name": currentTicket.owner,
                    "cf_ticket_number": currentTicket.id.toString(),
                    "cf_priority": document.getElementById('priority-dropdown').value,
                    "cf_correct_priority_reason": document.getElementById('priority-reason').value,
                    "cf_resolution_code": document.getElementById('res-code-dropdown').value,
                    "cf_correct_resolution_code_reason": document.getElementById('res-reason').value,
                    "cf_contact_information": document.getElementById('contact-info-dropdown').value,
                    "cf_correct_contact_information": document.getElementById('contact-info-reason').value,
                    "cf_tenant": isSpecialDept ? document.getElementById('tenant-dropdown').value : "",
                    "cf_reporter": isSpecialDept ? document.getElementById('reporter-dropdown').value : "",
                    "cf_environment": isSpecialDept ? document.getElementById('environment-dropdown').value : ""
                }
            };

            console.log("Audit Widget: Preparing to POST. Payload:", JSON.stringify(auditData));

            statusMsg.innerText = "Submitting...";
            statusMsg.style.color = "#666";

            ZOHODESK.request({
                url: 'https://desk.zoho.com/api/v1/cm_ticket_audits',
                type: 'POST',
                postBody: auditData,
                headers: { "orgId": "850352696", "featureFlags": "lookUp" },
                connectionLinkName: "zdesk"
            }).then(function (submitRes) {
                console.log("Audit Widget: API Raw Response:", submitRes);

                // 1. Parse the nested response string
                let responseData = {};
                try {
                    responseData = JSON.parse(submitRes.response);
                } catch (e) {
                    console.error("Audit Widget: Could not parse response body", e);
                }

                // 2. Check if the response contains an error code (even if status is 200)
                if (responseData.errorCode) {
                    console.error("Audit Widget: API Logic Error:", responseData.errorCode, responseData.message);
                    statusMsg.innerText = "Error: " + (responseData.message || responseData.errorCode);
                    statusMsg.style.color = "red";
                    alert("Submission Failed: " + (responseData.message || "OAuth/Organization Mismatch"));
                    return;
                }

                // 3. Success Path
                console.log("Audit Widget: Success!");
                statusMsg.innerText = "Audit Submitted Successfully!";
                statusMsg.style.color = "green";

                // Reset all fields and hide reasons
                const allFields = ['priority-dropdown', 'priority-reason', 'res-code-dropdown', 'res-reason', 'contact-info-dropdown', 'contact-info-reason'];
                allFields.forEach(id => {
                    document.getElementById(id).value = "";
                    document.getElementById(id).classList.remove('error-border');
                });
                document.getElementById('priority-reason-wrapper').classList.add('hidden');
                document.getElementById('res-reason-wrapper').classList.add('hidden');
                document.getElementById('contact-info-reason-wrapper').classList.add('hidden');

            }).catch(function (error) {
                // This handles network failures or 4xx/5xx status codes
                console.error("Audit Widget: Network/Request Error:", error);
                statusMsg.innerText = "Submission Error. Check connection.";
                statusMsg.style.color = "red";
                alert("Critical Error: Could not reach the server.");
            });
        };

        document.querySelectorAll('select, textarea').forEach(el => {
            el.addEventListener('input', () => el.classList.remove('error-border'));
        });

    }).catch(function (err) {
        console.error("Audit Widget: SDK Initialization Failed!", err);
    });
};