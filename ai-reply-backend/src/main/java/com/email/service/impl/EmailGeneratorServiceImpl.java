package com.email.service.impl;

import com.email.model.EmailRequest;
import com.email.service.EmailGeneratorService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.pemistahl.lingua.api.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.*;

@Service
public class EmailGeneratorServiceImpl implements EmailGeneratorService {

    private final WebClient webClient;
    private final LanguageDetector detector;

    @Value("${gemini.api.url}")
    private String geminiApiUrl;

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    public EmailGeneratorServiceImpl(WebClient.Builder webClient) {
        this.webClient = WebClient.builder().build();

        // Build Lingua detector with multiple languages
        this.detector = LanguageDetectorBuilder.fromLanguages(
                Language.ENGLISH,
                Language.HINDI,
                Language.FRENCH,
                Language.SPANISH,
                Language.GERMAN,
                Language.CHINESE,
                Language.JAPANESE
        ).withMinimumRelativeDistance(0.3).build();
    }

    @Override
    public String generateEmailReply(EmailRequest emailRequest) {
        // 1. Clean and detect language if "auto"
        String language = emailRequest.getLanguage();
        if (language == null || language.equalsIgnoreCase("auto")) {
            language = detectLanguage(cleanEmailText(emailRequest.getEmailContent()));
        }

        // 2. Build prompt
        String prompt = buildPrompt(emailRequest, language);

        // 3. Prepare request body
        Map<String, Object> requestBody = Map.of(
                "contents", new Object[]{
                        Map.of("parts", new Object[]{
                                Map.of("text", prompt)
                        })
                }
        );

        // 4. Make API call
        String response = webClient.post()
                .uri(geminiApiUrl + "?key=" + geminiApiKey)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        return extractResponseContent(response);
    }

    private String detectLanguage(String text) {
        if (text == null || text.trim().isEmpty() || text.split("\\s+").length < 5) {
            return "en"; // fallback for short text
        }

        Optional<Language> lang = Optional.ofNullable(detector.detectLanguageOf(text));
        if (lang.isPresent()) {
            Map<Language, Double> probabilities = detector.computeLanguageConfidenceValues(text);
            double confidence = probabilities.getOrDefault(lang.get(), 0.0);

            if (confidence >= 0.7) {
                return lang.get().getIsoCode639_1().toString(); // "en", "hi", etc.
            }
        }
        return "en"; // fallback
    }



    private String cleanEmailText(String emailContent) {
        return emailContent
                .replaceAll("(?i)(Regards,|Best,|Thanks,).*", "")
                .replaceAll("(?i)(From:|To:|Subject:).*", "")
                .trim();
    }

    private String buildPrompt(EmailRequest emailRequest, String language) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Generate a professional ")
                .append(emailRequest.getPlatform())
                .append(" reply in ")
                .append(language)
                .append(" for the following content. ")
                .append("Please do not generate subject header or extra text. ")
                .append("Generate only one reply.");

        if (emailRequest.getTone() != null && !emailRequest.getTone().isEmpty()) {
            prompt.append("\n Use a ").append(emailRequest.getTone()).append(" tone.");
        }

        if (emailRequest.getLength() != null && !emailRequest.getLength().isEmpty()) {
            if (emailRequest.getLength().equalsIgnoreCase("short")) {
                prompt.append("\n Keep the reply short and concise.");
            } else if (emailRequest.getLength().equalsIgnoreCase("detailed")) {
                prompt.append("\n Make the reply detailed and comprehensive.");
            }
        }

        prompt.append("\n Original ").append(emailRequest.getPlatform()).append(" Message:\n")
                .append(emailRequest.getEmailContent());

        return prompt.toString();
    }

    private String extractResponseContent(String response) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode rootNode = mapper.readTree(response);

            JsonNode candidatesNode = rootNode.path("candidates");
            if (candidatesNode.isArray() && candidatesNode.size() > 0) {
                JsonNode contentNode = candidatesNode.get(0).path("content");
                if (contentNode != null) {
                    JsonNode partsNode = contentNode.path("parts");
                    if (partsNode.isArray() && partsNode.size() > 0) {
                        JsonNode textNode = partsNode.get(0).path("text");
                        if (textNode != null) {
                            return textNode.asText();
                        }
                    }
                }
            }
            return "API response was malformed or empty.";
        } catch (Exception e) {
            return "Error processing response: " + e.getMessage();
        }
    }
}
