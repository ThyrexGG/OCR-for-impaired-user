#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Khmer Linguistic Frontend for Neural TTS (Training & Inference)
===============================================================
Provides:
  1. Unicode Canonicalization & OCR Glyph Repair (composite vowel restoration)
  2. Khmer Text Normalizer (Numerals, Currency ៛/$, Time, Dates, Abbreviations, ៗ Repeater)
  3. Orthographic Closed-Syllable + Lexicon Maximum-Matching Khmer Word Segmenter
  4. A-Series (Akhosak) / O-Series (Khosak) Register-Aware Grapheme-to-Phoneme (G2P) Engine
     converting arbitrary Khmer script into exact IPA phoneme tokens for VITS / StyleTTS2.
"""

from __future__ import annotations
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ============================================================================
# 1. KHMER UNICODE & REGISTER TABLES (U+1780 .. U+17FF)
# ============================================================================

CONSONANT_INFO: Dict[str, Tuple[str, str, str]] = {
    # Char: (Onset_IPA, Coda_IPA, Register: 'A' or 'O')
    "ក": ("k", "k̚", "A"),
    "ខ": ("kʰ", "k̚", "A"),
    "គ": ("k", "k̚", "O"),
    "ឃ": ("kʰ", "k̚", "O"),
    "ង": ("ŋ", "ŋ", "O"),
    "ច": ("c", "c̚", "A"),
    "ឆ": ("cʰ", "c̚", "A"),
    "ជ": ("c", "c̚", "O"),
    "ឈ": ("cʰ", "c̚", "O"),
    "ញ": ("ɲ", "ɲ", "O"),
    "ដ": ("d", "t̚", "A"),
    "ឋ": ("tʰ", "t̚", "A"),
    "ឌ": ("d", "t̚", "O"),
    "ឍ": ("tʰ", "t̚", "O"),
    "ណ": ("n", "n", "A"),
    "ត": ("t", "t̚", "A"),
    "ថ": ("tʰ", "t̚", "A"),
    "ទ": ("t", "t̚", "O"),
    "ធ": ("tʰ", "t̚", "O"),
    "ន": ("n", "n", "O"),
    "ប": ("b", "p̚", "A"),
    "ផ": ("pʰ", "p̚", "A"),
    "ព": ("p", "p̚", "O"),
    "ភ": ("pʰ", "p̚", "O"),
    "ម": ("m", "m", "O"),
    "យ": ("j", "j", "O"),
    "រ": ("r", "", "O"),
    "ល": ("l", "l", "O"),
    "វ": ("v", "w", "O"),
    "ស": ("s", "h", "A"),
    "ហ": ("h", "", "A"),
    "ឡ": ("l", "l", "A"),
    "អ": ("ʔ", "", "A"),
}

SONORANT_CONSONANTS = {"ង", "ញ", "ន", "ម", "យ", "រ", "ល", "វ"}

VOWEL_IPA: Dict[str, Tuple[str, str]] = {
    "": ("ɑː", "ɔː"),
    "ា": ("aː", "iə"),
    "ិ": ("ə", "ɨ"),
    "ី": ("əj", "iː"),
    "ឹ": ("ə", "ɨ"),
    "ឺ": ("əɨ", "ɨː"),
    "ុ": ("o", "u"),
    "ូ": ("oː", "uː"),
    "ួ": ("uə", "uə"),
    "ើ": ("aə", "əː"),
    "ឿ": ("ɨə", "ɨə"),
    "ៀ": ("iə", "iə"),
    "េ": ("eː", "eː"),
    "ែ": ("ae", "ɛː"),
    "ៃ": ("aj", "ɨj"),
    "ោ": ("ao", "oː"),
    "ៅ": ("aw", "ɨw"),
    "ុំ": ("om", "um"),
    "ំ": ("ɑm", "um"),
    "ាំ": ("am", "oăm"),
    "ះ": ("ah", "eəh"),
    "ុះ": ("oh", "uh"),
    "េះ": ("eh", "ih"),
    "ោះ": ("ɑh", "uəh"),
}

INDEPENDENT_VOWELS: Dict[str, Tuple[str, str]] = {
    "ឥ": ("អិ", "ʔə"),
    "ឦ": ("អី", "ʔəj"),
    "ឧ": ("អុ", "ʔo"),
    "ឨ": ("អុក", "ʔok"),
    "ឩ": ("អូ", "ʔoː"),
    "ឪ": ("អូវ", "ʔəw"),
    "ឫ": ("រឹ", "rɨ"),
    "ឬ": ("រឺ", "rɨː"),
    "ឭ": ("លឹ", "lɨ"),
    "ឮ": ("លឺ", "lɨː"),
    "ឯ": ("អែ", "ʔae"),
    "ឰ": ("អៃ", "ʔaj"),
    "ឱ": ("អោ", "ʔao"),
    "ឲ": ("អោយ", "ʔaoj"),
    "ឳ": ("អៅ", "ʔaw"),
}

# ============================================================================
# 2. KHMER NUMERALS, MONTHS, ABBREVIATIONS & PHONETIC LEXICON
# ============================================================================

KHMER_DIGIT_MAP = str.maketrans("០១២៣៤៥៦៧៨៩", "0123456789")

UNITS_KH = ["សូន្យ", "មួយ", "ពីរ", "បី", "បួន", "ប្រាំ", "ប្រាំមួយ", "ប្រាំពីរ", "ប្រាំបី", "ប្រាំបួន"]
TENS_KH = ["", "ដប់", "ម្ភៃ", "សាមសិប", "សែសិប", "ហាសិប", "ហុកសិប", "ចិតសិប", "ប៉ែតសិប", "កៅសិប"]

MONTHS_KH = {
    1: "មករា", 2: "កុម្ភៈ", 3: "មីនា", 4: "មេសា",
    5: "ឧសភា", 6: "មិថុនា", 7: "កក្កដា", 8: "សីហា",
    9: "កញ្ញា", 10: "តុលា", 11: "វិច្ឆិកា", 12: "ធ្នូ",
}

ABBREVIATIONS_KH: Dict[str, str] = {
    "គ.ស.": "គ្រិស្តសករាជ",
    "ព.ស.": "ពុទ្ធសករាជ",
    "ឯ.ឧ.": "ឯកឧត្តម",
    "ស.រ.អា.": "សហរដ្ឋអាមេរិក",
    "អ.ស.ប.": "អង្គការសហប្រជាជាតិ",
    "ក្រសួង ស.អ.យ.": "ក្រសួងសង្គមកិច្ច អតីតយុទ្ធជន និងយុវនីតិសម្បទា",
    "ម.គ.ផ.": "មន្ទីរពេទ្យគន្ធបុប្ផា",
    "គ.ជ.ប.": "គណៈកម្មាធិការជាតិរៀបចំការបោះឆ្នោត",
    "ភ.ព.": "ភ្នំពេញ",
    "ម.ម.": "មីលីម៉ែត្រ",
    "ស.ម.": "សង់ទីម៉ែត្រ",
    "គ.ម.": "គីឡូម៉ែត្រ",
    "គ.ក្រ.": "គីឡូក្រាម",
    "ម.ក្រ.": "មីលីក្រាម",
}

UNIT_SUFFIXES: Dict[str, str] = {
    "mg": "មីលីក្រាម",
    "ml": "មីលីលីត្រ",
    "kg": "គីឡូក្រាម",
    "km": "គីឡូម៉ែត្រ",
    "cm": "សង់ទីម៉ែត្រ",
    "mm": "មីលីម៉ែត្រ",
}

DEFAULT_LEXICON: Dict[str, Dict[str, str]] = {
    "សូម": {"respell": "សូម", "ipa": "soːm"},
    "ស្វាគមន៍": {"respell": "ស្វា-គម", "ipa": "svaː.kɔm"},
    "មក": {"respell": "មក", "ipa": "mɔːk"},
    "កាន់": {"respell": "កាន់", "ipa": "kan"},
    "ប្រព័ន្ធ": {"respell": "ប្រ-ពាន់", "ipa": "prɑː.pɔăn"},
    "អាន": {"respell": "អាន", "ipa": "ʔaːn"},
    "អត្ថបទ": {"respell": "អាត់-ថៈ-បត់", "ipa": "ʔat.tʰaʔ.bɑt"},
    "ភាសាខ្មែរ": {"respell": "ភា-សា-ខ្មែរ", "ipa": "pʰiə.saː.kʰmae"},
    "សម្រាប់": {"respell": "សំ-រាប់", "ipa": "sɑm.rap"},
    "ជនពិការភ្នែក": {"respell": "ជន-ពិ-ការ-ភ្នែក", "ipa": "cɔn.pi.kaː.pʰnɛːk"},
    "សុខភាព": {"respell": "សុខ-ភិប", "ipa": "sok.kʰa.pʰiəp"},
    "រដ្ឋាភិបាល": {"respell": "រាត់-ថា-ភិ-បាល", "ipa": "rɑt.tʰaː.pʰi.baːl"},
    "ប្រទេស": {"respell": "ប្រ-ទេស", "ipa": "prɑː.teːh"},
    "ព្រះអាទិត្យ": {"respell": "ព្រះ-អា-ទិត", "ipa": "preəh.ʔaː.tɨt"},
    "សិទ្ធិ": {"respell": "សិត", "ipa": "sət"},
    "ពាក្យ": {"respell": "ពាក", "ipa": "piək"},
    "កាលៈទេសៈ": {"respell": "កា-លៈ-ទេ-សៈ", "ipa": "kaː.laʔ.teː.saʔ"},
    "សម្តេច": {"respell": "សំ-ដាច់", "ipa": "sɑm.dac"},
    "សម្ដេច": {"respell": "សំ-ដាច់", "ipa": "sɑm.dac"},
    "ព្រះរាជាណាចក្រ": {"respell": "ព្រះ-រា-ជា-ណា-ចាក់", "ipa": "preəh.riə.ciə.naː.cak"},
    "កម្ពុជា": {"respell": "កាំ-ពុ-ជា", "ipa": "kam.pu.ciə"},
    "សាកលវិទ្យាល័យ": {"respell": "សា-កល់-វិ-ទ្យា-ល័យ", "ipa": "saː.kɑl.vi.tjiə.laj"},
    "បច្ចេកវិទ្យា": {"respell": "បាច់-ចេក-កៈ-វិ-ទ្យា", "ipa": "bac.ceːk.kaʔ.vi.tjiə"},
    "វេជ្ជបណ្ឌិត": {"respell": "វេច-ជៈ-បន់-ឌិត", "ipa": "vec.ceəʔ.bɑn.dɨt"},
    "វេជ្ជបញ្ជា": {"respell": "វេច-ជៈ-បាញ់-ជា", "ipa": "vec.ceəʔ.baɲ.ciə"},
    "ឱសថស្ថាន": {"respell": "អោ-សុត-ស្ថាន", "ipa": "ʔao.sot.stʰaːn"},
    "ប៉ារ៉ាសេតាម៉ុល": {"respell": "ប៉ា-រ៉ា-សេ-តា-ម៉ុល", "ipa": "paː.raː.seː.taː.mol"},
    "អាម៉ុកស៊ីស៊ីលីន": {"respell": "អា-ម៉ុក-ស៊ី-ស៊ី-លីន", "ipa": "ʔaː.mok.siː.siː.liːn"},
    "អាហារូបត្ថម្ភ": {"respell": "អា-ហា-រូ-បាត់-ថាំ", "ipa": "ʔaː.haː.ruː.bat.tʰam"},
    "ទូរស័ព្ទ": {"respell": "ទូ-រៈ-សាប់", "ipa": "tuː.reəʔ.sap"},
    "ប្រជាពលរដ្ឋ": {"respell": "ប្រ-ជា-ពល់-រាត់", "ipa": "prɑː.ciə.pʊəl.rɑt"},
    "អត្តសញ្ញាណប័ណ្ណ": {"respell": "អាត់-តៈ-សាញ់-ញាណ-ប័ន", "ipa": "ʔat.taʔ.saɲ.ɲaːn.ban"},
    "ក្រសួងសុខាភិបាល": {"respell": "ក្រ-សួង-សុ-ខា-ភិ-បាល", "ipa": "krɑː.suəŋ.so.kʰaː.pʰi.baːl"},
    "មន្ទីរពេទ្យគន្ធបុប្ផា": {"respell": "មន់-ទី-ពេត-គន់-ធៈ-បុប-ផា", "ipa": "mʊən.tiː.peːt.kʊən.tʰeəʔ.bop.pʰaː"},
    "ជំនួយការ": {"respell": "ជំ-នួយ-ការ", "ipa": "cum.nuəj.kaː"},
    "ឯកសារ": {"respell": "អែក-កៈ-សារ", "ipa": "ʔaek.kaʔ.saː"},
    "វិក្កយបត្រ": {"respell": "វិក-កៃ-បាត់", "ipa": "vik.kaj.bat"},
    "តម្លៃ": {"respell": "តំ-លៃ", "ipa": "tɑm.laj"},
}


def int_to_khmer_words(n: int) -> str:
    """Converts any non-negative integer into natural spoken Khmer words."""
    if n < 0:
        return "ដក " + int_to_khmer_words(-n)
    if n < 10:
        return UNITS_KH[n]
    if n < 100:
        tens, rem = divmod(n, 10)
        return TENS_KH[tens] + ("" if rem == 0 else UNITS_KH[rem])
    if n < 1000:
        hundreds, rem = divmod(n, 100)
        return UNITS_KH[hundreds] + "រយ" + ("" if rem == 0 else " " + int_to_khmer_words(rem))

    scales = [
        (10_000_000, "កោដិ"),
        (1_000_000, "លាន"),
        (100_000, "សែន"),
        (10_000, "ម៉ឺន"),
        (1_000, "ពាន់"),
    ]
    for scale_val, scale_name in scales:
        if n >= scale_val:
            head, rem = divmod(n, scale_val)
            return int_to_khmer_words(head) + scale_name + ("" if rem == 0 else " " + int_to_khmer_words(rem))
    return str(n)


@dataclass
class LinguisticAnalysis:
    raw_text: str
    canonical_text: str
    normalized_text: str
    phonetic_respelling: str
    words: List[str]
    ipa_tokens: List[str]
    ipa_string: str


class KhmerLinguisticEngine:
    """
    Production Khmer Text Normalizer, Closed-Syllable Segmenter, and Register-Aware G2P Engine.
    """

    def __init__(self, custom_lexicon_path: Optional[Path] = None) -> None:
        self.lexicon_path = custom_lexicon_path or (Path(__file__).parent / "khmer_lexicon.json")
        self.lexicon: Dict[str, Dict[str, str]] = dict(DEFAULT_LEXICON)
        self._load_or_init_lexicon()

    def _load_or_init_lexicon(self) -> None:
        if self.lexicon_path.exists():
            try:
                user_lex = json.loads(self.lexicon_path.read_text(encoding="utf-8"))
                self.lexicon.update(user_lex)
            except Exception:
                pass
        self.lexicon_path.write_text(
            json.dumps(self.lexicon, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def add_lexicon_entry(self, word: str, respell: str, ipa: str) -> None:
        self.lexicon[word.strip()] = {"respell": respell.strip(), "ipa": ipa.strip()}
        self.lexicon_path.write_text(
            json.dumps(self.lexicon, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def canonicalize_khmer(self, text: str) -> str:
        text = unicodedata.normalize("NFC", text)
        text = text.replace("\u200c", "").replace("\u200d", "")
        text = re.sub(r"\u17c1\u17b6", "\u17c4", text)
        text = re.sub(r"\u17c1\u17b8", "\u17be", text)
        return text

    def normalize_khmer_text(self, text: str) -> str:
        s = self.canonicalize_khmer(text)

        for abbr, full_kh in sorted(ABBREVIATIONS_KH.items(), key=lambda x: -len(x[0])):
            s = s.replace(abbr, f" {full_kh} ")

        s_digits = s.translate(KHMER_DIGIT_MAP)

        # Expand metric/dosage suffixes attached to numbers (e.g., 500mg -> 500 មីលីក្រាម)
        for unit_en, unit_kh in UNIT_SUFFIXES.items():
            s_digits = re.sub(
                rf"(\d+(?:\.\d+)?)\s*{unit_en}\b",
                rf"\1 {unit_kh} ",
                s_digits,
                flags=re.IGNORECASE,
            )

        # Expand Dates: optional ថ្ងៃទី + DD/MM/YYYY
        def _expand_date(m: re.Match) -> str:
            d, mo, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if 1 <= d <= 31 and 1 <= mo <= 12:
                return f" ថ្ងៃទី{int_to_khmer_words(d)} ខែ{MONTHS_KH[mo]} ឆ្នាំ{int_to_khmer_words(yr)} "
            return m.group(0)

        s_digits = re.sub(r"(?:ថ្ងៃទី\s*)?\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", _expand_date, s_digits)

        # Expand Time: optional ម៉ោង + HH:MM
        def _expand_time(m: re.Match) -> str:
            hh, mm = int(m.group(1)), int(m.group(2))
            if mm == 0:
                return f" ម៉ោង{int_to_khmer_words(hh)}គត់ "
            if mm == 30:
                return f" ម៉ោង{int_to_khmer_words(hh)}កន្លះ "
            return f" ម៉ោង{int_to_khmer_words(hh)} និង{int_to_khmer_words(mm)}នាទី "

        s_digits = re.sub(r"(?:ម៉ោង\s*)?(\d{1,2}):(\d{2})\b", _expand_time, s_digits)

        # Expand Currency: Riel (៛) and USD ($)
        s_digits = re.sub(
            r"(\d[\d,]*)\s*៛",
            lambda m: f" {int_to_khmer_words(int(m.group(1).replace(',', '')))}រៀល ",
            s_digits,
        )

        def _expand_usd(m: re.Match) -> str:
            raw = (m.group(1) or m.group(2)).replace(",", "")
            if "." in raw:
                dollars, cents = raw.split(".", 1)
                d_words = int_to_khmer_words(int(dollars))
                c_val = int((cents + "0")[:2])
                if c_val > 0:
                    return f" {d_words}ដុល្លារ និង{int_to_khmer_words(c_val)}សេន "
                return f" {d_words}ដុល្លារ "
            return f" {int_to_khmer_words(int(raw))}ដុល្លារ "

        s_digits = re.sub(r"\$\s*(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*\$", _expand_usd, s_digits)

        # Expand Percentages (%)
        s_digits = re.sub(
            r"(\d+(?:\.\d+)?)\s*%",
            lambda m: f" {self._number_str_to_khmer(m.group(1))}ភាគរយ ",
            s_digits,
        )

        # Expand Remaining Standalone Numbers
        s_digits = re.sub(
            r"\b\d[\d,]*(?:\.\d+)?\b",
            lambda m: f" {self._number_str_to_khmer(m.group(0))} ",
            s_digits,
        )

        # Expand Repeater Symbol `ៗ` (lek too)
        s_digits = re.sub(r"([ក-៻]+)\s*ៗ", r"\1 \1", s_digits)

        s_digits = re.sub(r"។ល។", " ហើយនិងដទៃទៀត ", s_digits)
        s_digits = re.sub(r"។", " ។ ", s_digits)
        s_digits = re.sub(r"\s+", " ", s_digits).strip()
        return s_digits

    def _number_str_to_khmer(self, num_str: str) -> str:
        clean = num_str.replace(",", "")
        if "." in clean:
            left, right = clean.split(".", 1)
            right_digits = " ".join(UNITS_KH[int(ch)] for ch in right if ch.isdigit())
            return f"{int_to_khmer_words(int(left))} ចុច {right_digits}"
        return int_to_khmer_words(int(clean))

    def segment_words(self, normalized_text: str) -> List[str]:
        tokens: List[str] = []
        dict_words = set(self.lexicon.keys()) | set(UNITS_KH) | set(TENS_KH) | set(MONTHS_KH.values())

        # Closed Khmer orthographic syllable pattern:
        # Base consonant + optional subscript(s) + optional vowel/diacritic + optional final coda consonant
        # (where the coda consonant is NOT followed by a vowel, coeng, or shifter)
        closed_syl_re = re.compile(
            r"^[ក-អឥ-ឳ](?:\u17d2[ក-អ])*(?:[\u17b6-\u17d1\u17d3\u17dd])*"
            r"(?:[ក-អ](?:\u17cb|\u17cd)?(?![\u17d2\u17b6-\u17c8\u17c9\u17ca]))?|[ក-៻]"
        )

        for chunk in normalized_text.split():
            if not re.search(r"[ក-៻]", chunk):
                tokens.append(chunk)
                continue

            i = 0
            n = len(chunk)
            while i < n:
                matched = None
                for end in range(min(n, i + 22), i + 1, -1):
                    cand = chunk[i:end]
                    if cand in dict_words:
                        matched = cand
                        break
                if matched:
                    tokens.append(matched)
                    i += len(matched)
                else:
                    syl_match = closed_syl_re.match(chunk[i:])
                    step = len(syl_match.group(0)) if syl_match else 1
                    tokens.append(chunk[i : i + step])
                    i += step
        return tokens

    def syllable_to_ipa(self, syl: str) -> str:
        if syl in self.lexicon:
            return self.lexicon[syl]["ipa"]
        if syl in INDEPENDENT_VOWELS:
            return INDEPENDENT_VOWELS[syl][1]
        if syl == "។":
            return "|"

        n = len(syl)
        if n == 0:
            return ""

        base_ch = syl[0]
        if base_ch not in CONSONANT_INFO:
            return syl

        onset_ipa, _, reg = CONSONANT_INFO[base_ch]
        i = 1

        while i + 1 < n and syl[i] == "\u17d2" and syl[i + 1] in CONSONANT_INFO:
            sub_ch = syl[i + 1]
            sub_onset, _, sub_reg = CONSONANT_INFO[sub_ch]
            onset_ipa += sub_onset
            if sub_ch not in SONORANT_CONSONANTS:
                reg = sub_reg
            i += 2

        vowel_chars = ""
        has_bantoc = False
        has_tantakhiat = False
        coda_chars = ""

        while i < n:
            ch = syl[i]
            if ch == "\u17c9":
                reg = "A"
            elif ch == "\u17ca":
                reg = "O"
            elif ch == "\u17cb":
                has_bantoc = True
            elif ch == "\u17cd":
                has_tantakhiat = True
            elif "\u17b6" <= ch <= "\u17c8":
                vowel_chars += ch
            elif ch in CONSONANT_INFO:
                coda_chars += ch
            i += 1

        if has_tantakhiat and not vowel_chars and not coda_chars:
            return ""

        v_pair = VOWEL_IPA.get(vowel_chars, VOWEL_IPA.get(vowel_chars[:1], ("ɑː", "ɔː")))
        v_ipa = v_pair[0] if reg == "A" else v_pair[1]

        if has_bantoc or coda_chars:
            # Closed syllables or bantoc shorten inherent/long vowels naturally
            if has_bantoc:
                v_ipa = v_ipa.replace("ː", "")

        coda_ipa = ""
        if coda_chars:
            last_coda = coda_chars[-1]
            coda_ipa = CONSONANT_INFO.get(last_coda, ("", "", "A"))[1]

        return f"{onset_ipa}{v_ipa}{coda_ipa}"

    def analyze(self, raw_text: str) -> LinguisticAnalysis:
        canonical = self.canonicalize_khmer(raw_text)
        normalized = self.normalize_khmer_text(canonical)
        words = self.segment_words(normalized)

        respell_parts: List[str] = []
        ipa_tokens: List[str] = []

        for w in words:
            if w in self.lexicon:
                respell_parts.append(self.lexicon[w]["respell"])
                ipa_tokens.append(self.lexicon[w]["ipa"])
            elif re.search(r"[ក-៻]", w):
                respell_parts.append(w)
                ipa_tokens.append(self.syllable_to_ipa(w))
            else:
                respell_parts.append(w)
                ipa_tokens.append(w)

        return LinguisticAnalysis(
            raw_text=raw_text,
            canonical_text=canonical,
            normalized_text=normalized,
            phonetic_respelling=" ".join(respell_parts),
            words=words,
            ipa_tokens=ipa_tokens,
            ipa_string=" ".join(t for t in ipa_tokens if t),
        )
