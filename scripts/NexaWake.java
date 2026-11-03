package com.amadu.nexaai;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Finds the wake word ("Nexa") at the start of what the phone heard and gives back what was
 * said after it. Plain Java with no Android parts, so it can be tested on a computer.
 */
public final class NexaWake {

    private NexaWake() {}

    // The ways a speech recogniser may write the name "Nexa".
    private static final String NAME =
        "(?:nexa|nexxa|nexsa|neksa|necsa|nexta|nexus|nexia|nexsia|neksia|nexar|nixa|naxa|nekza|nexha"
            + "|next\\s+a|next\\s+sa|next\\s+sir|nex\\s+a|nex\\s+sa|neck\\s?sa|necks\\s?a|neck\\s+sir)";

    // [greeting] NAME [punctuation] rest
    private static final Pattern WAKE = Pattern.compile(
        "^[\\s\\p{Punct}]*(?:(?:hey|hi|hello|ok|okay|yo)[\\s\\p{Punct}]+)?"
            + NAME
            + "(?![\\p{L}\\p{N}])[\\s\\p{Punct}]*(.*)$",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE | Pattern.DOTALL
    );

    /**
     * @return null when the wake word is not at the start; "" when only the wake word was said;
     *         otherwise the command that follows it, exactly as heard.
     */
    public static String extractCommand(String heard) {
        if (heard == null) {
            return null;
        }
        Matcher m = WAKE.matcher(heard.trim());
        if (!m.matches()) {
            return null;
        }
        String rest = m.group(1);
        return rest == null ? "" : rest.trim();
    }
}
