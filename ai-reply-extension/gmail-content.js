console.log("SmartReply Gmail Extension - Content Script Loaded");

function getEmailContent() {
    const selectors = [
        '.h7',
        '.a3s.aiL',
        '.gmail_quote',
        '[role="presentation"]'
    ];
    
    for (const selector of selectors) {
        const content = document.querySelector(selector);
        if (content) {
            return content.innerHTML.trim();
        }
    }
    return "";
}

function findComposeToolbar() {
    const selectors = [
        '.btC',
        '.aDh',
        '[role="toolbar"]',
        '.gU.Up'
    ];
    
    for (const selector of selectors) {
        const toolbar = document.querySelector(selector);
        if (toolbar) {
            return toolbar;
        }
    }
    return null;
}

// New function to create SmartReply pop-up with Language selector
function createSmartReplyPopup() {
    const popup = document.createElement('div');
    popup.className = 'smart-reply-popup';
    popup.innerHTML = `
        <div class="smart-reply-header">SmartReply Options</div>
        
        <div class="smart-reply-section">
            <div class="section-label">Tone:</div>
            <div class="tone-options option-group">
                <button class="option-button" data-option-type="tone" data-option-value="professional">Professional</button>
                <button class="option-button" data-option-type="tone" data-option-value="friendly">Friendly</button>
                <button class="option-button" data-option-type="tone" data-option-value="formal">Formal</button>
                <button class="option-button" data-option-type="tone" data-option-value="casual">Casual</button>
                <button class="option-button" data-option-type="tone" data-option-value="enthusiastic">Enthusiastic</button>
                <button class="option-button" data-option-type="tone" data-option-value="concise">Concise</button>
                <button class="option-button" data-option-type="tone" data-option-value="apologetic">Apologetic</button>
                <button class="option-button" data-option-type="tone" data-option-value="persuasive">Persuasive</button>
            </div>
        </div>
        
        <div class="smart-reply-section">
            <div class="section-label">Length:</div>
            <div class="length-options option-group">
                <button class="option-button" data-option-type="length" data-option-value="short">Short</button>
                <button class="option-button" data-option-type="length" data-option-value="detailed">Detailed</button>
            </div>
        </div>

        <div class="smart-reply-section">
    <div class="section-label">Language:</div>
    <select class="language-select">
        <option value="auto" selected>Auto Detect</option>
        <option value="english">English</option>
        <option value="hindi">Hindi</option>
        <option value="french">French</option>
        <option value="spanish">Spanish</option>
        <option value="german">German</option>
    </select>
</div>
        
        <button class="generate-reply-button">Generate Reply</button>
    `;

    return popup;
}

function createAIButton() {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'ai-button-container';
    buttonContainer.style.cssText = `
        position: relative;
        display: inline-block;
        margin-right: 8px;
    `;

    const button = document.createElement('div');
    button.className = 'T-I J-J5-Ji aoO v7 T-I-atl L3';
    button.style.cssText = `
        border-radius: 24px;
        padding: 8px 16px;
        min-width: auto;
        cursor: pointer;
        position: relative;
    `;
    button.innerHTML = '✨ AI Reply';
    button.setAttribute('role', 'button');
    button.setAttribute('data-tooltip', 'Generate AI Reply');

    const popup = createSmartReplyPopup();
    
    buttonContainer.appendChild(button);
    buttonContainer.appendChild(popup);

    return { buttonContainer, button, popup };
}

async function generateReply(tone, length, language) {
    try {
        const emailContent = getEmailContent();
        const requestBody = {
            "emailContent": emailContent,
            "platform": "gmail",
            "tone": tone,
            "length": length,
            "language": language
        };

        const response = await fetch('http://localhost:8080/api/email/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error('API Request Failed');
        }

        const generatedReply = await response.text();
        const composeBox = document.querySelector('[role="textbox"][g_editable="true"]');
        
        if (composeBox) {
            composeBox.focus();
            document.execCommand('insertText', false, generatedReply);
        } else {
            console.error("Gmail compose box was not found");
        }
    } catch (error) {
        console.error('Gmail reply generation error:', error);
        alert("Failed to generate reply");
    }
}

function injectButton() {
    const existingButton = document.querySelector('.ai-button-container');
    if (existingButton) existingButton.remove();

    const toolbar = findComposeToolbar();
    if (!toolbar) {
        console.log("Gmail toolbar not found");
        return;
    }

    console.log("Gmail toolbar found, creating AI button");
    const { buttonContainer, button, popup } = createAIButton();
    
    let isGenerating = false;
    let isPopupOpen = false;

    let selectedTone = null;
    let selectedLength = null;

    // Toggle pop-up on button click
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (isGenerating) return;

        isPopupOpen = !isPopupOpen;
        popup.style.display = isPopupOpen ? 'block' : 'none';
    });

    // Handle option selection
    popup.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('option-button')) {
            const optionType = target.getAttribute('data-option-type');
            const optionValue = target.getAttribute('data-option-value');
            
            // Remove 'active' class from all buttons of the same type
            document.querySelectorAll(`.option-button[data-option-type="${optionType}"]`).forEach(btn => {
                btn.classList.remove('active');
            });

            // Add 'active' class to the clicked button
            target.classList.add('active');

            // Store the selected value
            if (optionType === 'tone') selectedTone = optionValue;
            if (optionType === 'length') selectedLength = optionValue;
        }
    });

    // Handle "Generate Reply" button click
    const generateButton = popup.querySelector('.generate-reply-button');
    generateButton.addEventListener('click', async () => {
        if (!selectedTone || !selectedLength) {
            alert("Please select a tone and length.");
            return;
        }
        
        const languageSelect = popup.querySelector('.language-select');
        const selectedLanguage = languageSelect ? languageSelect.value : "auto";

        isPopupOpen = false;
        popup.style.display = 'none';

        isGenerating = true;
        button.innerHTML = '⏳ Generating...';
        button.style.pointerEvents = 'none';
        button.style.opacity = '0.5';

        await generateReply(selectedTone, selectedLength, selectedLanguage);

        isGenerating = false;
        button.innerHTML = '✨ AI Reply';
        button.style.pointerEvents = 'auto';
        button.style.opacity = '1';
    });

    document.addEventListener('click', (e) => {
        if (!buttonContainer.contains(e.target)) {
            isPopupOpen = false;
            popup.style.display = 'none';
        }
    });

    toolbar.insertBefore(buttonContainer, toolbar.firstChild);
}

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        const addedNodes = Array.from(mutation.addedNodes);
        const hasComposeElements = addedNodes.some(node =>
            node.nodeType === Node.ELEMENT_NODE && (
                node.matches('.aDh, .btC, [role="dialog"]') ||
                node.querySelector('.aDh, .btC, [role="dialog"]')
            )
        );

        if (hasComposeElements) {
            console.log("Gmail Compose Window Detected");
            setTimeout(injectButton, 500);
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
