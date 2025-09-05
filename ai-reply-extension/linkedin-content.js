console.log("SmartReply LinkedIn Extension - Content Script Loaded");

function getMessageContent() {
    // Try to extract the latest LinkedIn chat or message text
    const selectors = [
        '.msg-s-message-list__event',
        '.msg-form__contenteditable',
        '[contenteditable="true"]'
    ];

    for (const selector of selectors) {
        const content = document.querySelector(selector);
        if (content) {
            return content.innerText.trim();
        }
    }
    return "";
}

function findMessageToolbar() {
    // LinkedIn message toolbar near send button
    const selectors = [
        '.msg-form__send-button-container',
        '.msg-form__right-actions'
    ];

    for (const selector of selectors) {
        const toolbar = document.querySelector(selector);
        if (toolbar) {
            return toolbar;
        }
    }
    return null;
}

// Create SmartReply pop-up with tone, length, and language options
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

    const button = document.createElement('button');
    button.className = 'artdeco-button artdeco-button--2';
    button.style.cssText = `
        border-radius: 24px;
        padding: 6px 12px;
        cursor: pointer;
        margin-left: 4px;
        background-color: #0a66c2;
        color: white;
        font-weight: 600;
    `;
    button.innerHTML = '✨ AI Reply';

    const popup = createSmartReplyPopup();
    buttonContainer.appendChild(button);
    buttonContainer.appendChild(popup);

    return { buttonContainer, button, popup };
}

async function generateReply(tone, length, language) {
    try {
        const messageContent = getMessageContent();
        const requestBody = {
            "emailContent": messageContent,
            "platform": "linkedin",
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
        const inputBox = document.querySelector('.msg-form__contenteditable[contenteditable="true"]');
        
        if (inputBox) {
            inputBox.focus();
            document.execCommand('insertText', false, generatedReply);
        } else {
            console.error("LinkedIn input box was not found");
        }
    } catch (error) {
        console.error('LinkedIn reply generation error:', error);
        alert("Failed to generate reply");
    }
}

function injectButton() {
    const existingButton = document.querySelector('.ai-button-container');
    if (existingButton) existingButton.remove();

    const toolbar = findMessageToolbar();
    if (!toolbar) {
        console.log("LinkedIn toolbar not found");
        return;
    }

    console.log("LinkedIn toolbar found, creating AI button");
    const { buttonContainer, button, popup } = createAIButton();
    
    let isGenerating = false;
    let isPopupOpen = false;

    let selectedTone = null;
    let selectedLength = null;

    // Toggle popup
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isGenerating) return;
        isPopupOpen = !isPopupOpen;
        popup.style.display = isPopupOpen ? 'block' : 'none';
    });

    // Handle tone/length options
    popup.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('option-button')) {
            const optionType = target.getAttribute('data-option-type');
            const optionValue = target.getAttribute('data-option-value');
            
            document.querySelectorAll(`.option-button[data-option-type="${optionType}"]`).forEach(btn => {
                btn.classList.remove('active');
            });

            target.classList.add('active');
            if (optionType === 'tone') selectedTone = optionValue;
            if (optionType === 'length') selectedLength = optionValue;
        }
    });

    // Generate reply click
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

    // Close popup when clicking outside
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
        const hasMessageBox = addedNodes.some(node =>
            node.nodeType === Node.ELEMENT_NODE && (
                node.matches('.msg-form__send-button-container, .msg-form__right-actions') ||
                node.querySelector('.msg-form__send-button-container, .msg-form__right-actions')
            )
        );

        if (hasMessageBox) {
            console.log("LinkedIn Message Window Detected");
            setTimeout(injectButton, 500);
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
