"""Local, deterministic multilingual comment moderation.

No external API or AI service is used. Comments are published immediately;
this module only marks comments that deserve admin review.
"""
import re
import unicodedata

FLAGGED_TERMS = {
    "en": {
        "profanity": {"fuck", "fucker", "fucking", "motherfucker", "shit", "shithead", "bitch", "bastard", "asshole", "bullshit", "cunt", "dickhead", "dumbass", "jackass", "piss off", "son of a bitch", "fuck off", "fuck you", "shithead", "stfu", "wtf"},
        "sexual": {"rape", "rapist", "porn", "porno", "pornography", "blowjob", "handjob", "dick pic", "send nudes", "sex video", "sexual assault"},
        "threat": {"kill you", "i will kill you", "i'll kill you", "i will hurt you", "i'll hurt you", "hurt you", "beat you up", "you will die", "go die", "die die die"},
        "harassment": {"idiot", "stupid", "loser", "moron", "shut up", "worthless", "piece of shit", "you suck", "get lost", "ugly loser"},
        "hate_discrimination": {"hate speech", "racist", "sexist", "homophobic", "xenophobic", "white supremacist", "racial slur"},
        "self_harm": {"suicide", "self harm", "self-harm", "kill myself", "want to die", "end my life"},
        "spam_scam": {"click here", "free money", "make money fast", "dm me for money", "guaranteed profit", "crypto giveaway", "you won a prize", "claim your prize", "whatsapp me", "telegram me", "investment opportunity"},
    },
    "hi": {
        "profanity": {"madarchod", "madar chod", "bhenchod", "behenchod", "gandu", "gaand", "harami", "haramkhor", "bakchod", "bakchodi", "randi", "lavde", "laude", "bhosdike", "bhosdi", "chutiya", "chutiye", "chutiye", "kamine", "kamina", "saala", "sala", "kutti", "kutte"},
        "harassment": {"nikal yahan se", "chup kar", "pagal", "bewakoof", "ullu ka pattha", "ghatiya insaan", "teri aukat", "aukat nahi", "चुप कर", "चुप हो जा", "बेवकूफ", "पागल", "घटिया इंसान"},
        "threat": {"maar dunga", "maar dungi", "jaan se maar", "uda dunga", "uda dungi", "dekh lunga", "dekh lungi", "tujhe maar"},
        "sexual": {"nanga", "nangi", "porn", "rape", "balatkar"},
        "hate_discrimination": {"jaatiwaadi", "bhedbhaav", "naslvaadi"},
        "spam_scam": {"free paisa", "paise kamao", "link par click", "inaam jeeta", "prize claim", "whatsapp karo", "telegram karo"},
        "regional_abuse": {"randichya", "aai ghalya", "aai zhavadya", "zhavnya", "zhavadya", "रांडीच्या", "आई घाल्या", "आई झवाड्या", "झवण्या", "झवाड्या"},
    },
    "mr": {
        "profanity": {"madarchod", "bhenchod", "gandu", "harami", "haramkhor", "bakchod", "bakchodi", "randi", "lavdya", "laudya", "bhosdya", "chutya", "chutiya", "kamina", "saala", "sala"},
        "harassment": {"vedya", "murkha", "bavlat", "gadhav", "ghatiya", "chup bas", "nigh itheun", "वेड्या", "मूर्ख", "बावळट", "गाढव", "घटिया", "चूप बस", "निघ इथून"},
        "threat": {"maarun taak", "jaan se maar", "tula maarto", "tula maarin", "baghun gheto", "baghun ghete"},
        "sexual": {"balatkar", "nagna", "nagn", "porn"},
        "hate_discrimination": {"jatiwad", "bhedbhav", "naslvaad"},
    },
    "bn": {"profanity": {"চোদা", "চোদাচুদি", "বাল", "হারামি", "খানকির ছেলে", "মাদারচোদ", "বাঞ্চোদ"}, "harassment": {"বোকাচোদা", "গাধা", "শুয়োর"}, "threat": {"মেরে ফেলব", "খুন করে দেব"}, "sexual": {"ধর্ষণ", "পর্ন"}},
    "gu": {"profanity": {"માદરચોદ", "બેનચોદ", "ગાંડો", "હરામી", "ચુતિયા", "રાંડ", "બકચોદ"}, "harassment": {"બેવકૂફ", "ગધેડો", "નકામો"}, "threat": {"મારી નાખીશ", "જાનથી મારીશ"}, "sexual": {"બળાત્કાર", "પોર્ન"}},
    "pa": {"profanity": {"ਮਾਦਰਚੋਦ", "ਭੈਣਚੋਦ", "ਗਾਂਡੂ", "ਹਰਾਮੀ", "ਚੂਤੀਆ", "ਰੰਡੀ", "ਲੌੜਾ"}, "harassment": {"ਬੇਵਕੂਫ", "ਗਧਾ", "ਨਿਕੰਮਾ"}, "threat": {"ਮਾਰ ਦਿਆਂਗਾ", "ਜਾਨੋਂ ਮਾਰ ਦਿਆਂਗਾ"}, "sexual": {"ਬਲਾਤਕਾਰ", "ਪੋਰਨ"}},
    "ta": {"profanity": {"தேவிடியா", "புண்ட", "புண்டை", "ஒத்தா", "சுன்னி", "நாயே"}, "harassment": {"முட்டாள்", "நாய்", "கேவலமானவன்"}, "threat": {"கொன்றுவிடுவேன்", "அடித்துவிடுவேன்"}, "sexual": {"கற்பழிப்பு", "ஆபாசம்"}},
    "te": {"profanity": {"దెంగు", "దెంగుడు", "లంజ", "పూకు", "దరిద్రుడు"}, "harassment": {"వెధవ", "మూర్ఖుడు", "పిచ్చివాడు"}, "threat": {"చంపేస్తా", "చంపేస్తాను", "కొట్టేస్తా"}, "sexual": {"అత్యాచారం", "పోర్న్"}},
    "kn": {"profanity": {"ಮೈರ್", "ಬೋಳಿ", "ಸೂಳೆ", "ಲೋಫರ್", "ತುಪ್ಪ"}, "harassment": {"ದಡ್ಡ", "ಹುಚ್ಚ", "ನಾಯಿ"}, "threat": {"ಕೊಲ್ಲುತ್ತೇನೆ", "ಹೊಡೆದುಬಿಡುತ್ತೇನೆ"}, "sexual": {"ಅತ್ಯಾಚಾರ", "ಪೋರ್ನ್"}},
    "ml": {"profanity": {"പൂറ്", "പുണ്ട", "തേവിടിച്ചി", "മൈരേ", "തെറി"}, "harassment": {"മണ്ടൻ", "നായേ", "പട്ടി"}, "threat": {"കൊന്നുകളയും", "തല്ലിക്കൊല്ലും"}, "sexual": {"ബലാത്സംഗം", "പോൺ"}},
    "ur": {"profanity": {"مدرچود", "بہن چود", "گاندو", "حرامی", "چوتیا", "رنڈی", "بھوسڑی"}, "harassment": {"بےوقوف", "پاگل", "کمینہ"}, "threat": {"جان سے مار دوں گا", "مار دوں گا"}, "sexual": {"زنا بالجبر", "فحش", "پورن"}},
    "ar": {"profanity": {"كس", "شرموطة", "قحبة", "خرا", "خول", "متناك", "ابن القحبة"}, "harassment": {"غبي", "أحمق", "حقير", "تافه"}, "threat": {"سأقتلك", "سوف أقتلك", "سأؤذيك", "سأضربك"}, "sexual": {"اغتصاب", "إباحية", "إباحي"}, "hate_discrimination": {"عنصري", "عنصرية"}},
    "es": {"profanity": {"puta", "puto", "mierda", "joder", "coño", "cabron", "cabrón", "gilipollas", "maricon", "maricón"}, "harassment": {"idiota", "imbécil", "estúpido", "perdedor", "cállate"}, "threat": {"te mataré", "voy a matarte", "te voy a matar", "te haré daño"}, "sexual": {"violación", "porno", "pornografía"}, "hate_discrimination": {"racista", "sexista", "homófobo"}},
    "fr": {"profanity": {"merde", "putain", "salope", "connard", "connasse", "enculé", "encule", "bordel", "nique"}, "harassment": {"idiot", "imbécile", "stupide", "loser", "ferme ta gueule"}, "threat": {"je vais te tuer", "je te tuerai", "je vais te frapper"}, "sexual": {"viol", "porno", "pornographie"}, "hate_discrimination": {"raciste", "sexiste", "homophobe"}},
    "de": {"profanity": {"scheiße", "scheisse", "fick", "ficker", "hurensohn", "arschloch", "fotze", "wichser"}, "harassment": {"idiot", "dummkopf", "blödmann", "verlierer", "halt die klappe"}, "threat": {"ich werde dich töten", "ich bringe dich um", "ich werde dich schlagen"}, "sexual": {"vergewaltigung", "porno", "pornografie"}, "hate_discrimination": {"rassist", "sexist", "homophob"}},
    "pt": {"profanity": {"merda", "porra", "puta", "puto", "caralho", "foda-se", "fodase", "viado", "filho da puta"}, "harassment": {"idiota", "imbecil", "estúpido", "otário", "cala a boca"}, "threat": {"vou te matar", "eu vou te matar", "vou te machucar"}, "sexual": {"estupro", "pornô", "pornografia"}, "hate_discrimination": {"racista", "sexista", "homofóbico"}},
    "it": {"profanity": {"merda", "cazzo", "stronzo", "stronza", "bastardo", "puttana", "vaffanculo", "figlio di puttana"}, "harassment": {"idiota", "stupido", "cretino", "perdente", "stai zitto"}, "threat": {"ti ucciderò", "ti ammazzo", "ti farò male"}, "sexual": {"stupro", "porno", "pornografia"}, "hate_discrimination": {"razzista", "sessista", "omofobo"}},
    "ru": {"profanity": {"блядь", "бля", "хуй", "хуесос", "пизда", "ебать", "ебаный", "сука", "мудак", "дебил"}, "harassment": {"идиот", "тупой", "ублюдок", "заткнись"}, "threat": {"я тебя убью", "убью тебя", "я тебя ударю"}, "sexual": {"изнасилование", "порно"}, "hate_discrimination": {"расист", "сексист", "гомофоб"}},
    "uk": {"profanity": {"блядь", "хуй", "пизда", "їбати", "сука", "мудак", "дебіл"}, "harassment": {"ідіот", "дурень", "заткнись"}, "threat": {"я тебе вб'ю", "я тебе вбю", "вб'ю тебе", "я тебе поб'ю"}, "sexual": {"зґвалтування", "порно"}},
    "pl": {"profanity": {"kurwa", "chuj", "cipa", "pizda", "jebac", "jebać", "skurwysyn", "dupek", "suka"}, "harassment": {"idiota", "debil", "kretyn", "zamknij się"}, "threat": {"zabiję cię", "zabije cie", "pobiję cię"}, "sexual": {"gwałt", "porno"}},
    "tr": {"profanity": {"siktir", "amk", "orospu", "piç", "yarrak", "bok", "şerefsiz", "kahpe"}, "harassment": {"aptal", "salak", "gerizekalı", "sus"}, "threat": {"seni öldüreceğim", "seni öldürürüm", "sana zarar vereceğim"}, "sexual": {"tecavüz", "porno"}, "hate_discrimination": {"ırkçı", "homofobik"}},
    "nl": {"profanity": {"kanker", "kut", "lul", "hoer", "godverdomme", "neuk", "klootzak"}, "harassment": {"idioot", "domkop", "loser", "hou je bek"}, "threat": {"ik vermoord je", "ik ga je vermoorden", "ik sla je"}, "sexual": {"verkrachting", "porno"}},
    "id": {"profanity": {"anjing", "bangsat", "bajingan", "kontol", "memek", "brengsek", "asu"}, "harassment": {"bodoh", "tolol", "idiot", "diam"}, "threat": {"aku akan membunuhmu", "akan membunuhmu", "aku akan menyakitimu"}, "sexual": {"pemerkosaan", "porno"}},
    "vi": {"profanity": {"đụ", "địt", "đĩ", "lồn", "cặc", "mẹ mày", "đồ chó"}, "harassment": {"ngu", "đần", "đồ ngốc", "câm mồm"}, "threat": {"tao sẽ giết mày", "tôi sẽ giết bạn", "tao sẽ đánh mày"}, "sexual": {"hiếp dâm", "khiêu dâm"}},
    "th": {"profanity": {"เหี้ย", "สัส", "ควย", "หี", "เย็ด", "อีดอก"}, "harassment": {"โง่", "ไอ้บ้า", "ไอ้ควาย"}, "threat": {"กูจะฆ่ามึง", "จะฆ่ามึง", "จะทำร้ายมึง"}, "sexual": {"ข่มขืน", "โป๊"}},
    "ko": {"profanity": {"씨발", "시발", "개새끼", "병신", "좆", "보지", "꺼져"}, "harassment": {"멍청이", "바보", "찐따"}, "threat": {"죽여버릴거야", "죽여버릴게", "널 죽일거야", "때려버릴거야"}, "sexual": {"강간", "야동", "포르노"}},
    "ja": {"profanity": {"くそ", "クソ", "死ね", "しね", "くたばれ", "ちんこ", "まんこ", "ばか"}, "harassment": {"馬鹿", "バカ", "アホ", "黙れ", "負け犬"}, "threat": {"殺してやる", "お前を殺す", "殴ってやる"}, "sexual": {"強姦", "ポルノ", "エロ"}},
    "zh": {"profanity": {"操", "草泥马", "傻逼", "妈的", "他妈的", "屌", "鸡巴", "婊子"}, "harassment": {"傻子", "白痴", "蠢货", "闭嘴", "废物"}, "threat": {"我要杀了你", "杀了你", "我要打你"}, "sexual": {"强奸", "色情", "黄片"}, "hate_discrimination": {"种族主义", "性别歧视", "恐同"}},
}

LANGUAGE_NAMES = {"en":"English","hi":"Hindi/Hinglish","mr":"Marathi","bn":"Bengali","gu":"Gujarati","pa":"Punjabi","ta":"Tamil","te":"Telugu","kn":"Kannada","ml":"Malayalam","ur":"Urdu","ar":"Arabic","es":"Spanish","fr":"French","de":"German","pt":"Portuguese","it":"Italian","ru":"Russian","uk":"Ukrainian","pl":"Polish","tr":"Turkish","nl":"Dutch","id":"Indonesian","vi":"Vietnamese","th":"Thai","ko":"Korean","ja":"Japanese","zh":"Chinese"}
CATEGORY_SEVERITY = {"profanity":"medium","regional_abuse":"medium","harassment":"medium","spam_scam":"medium","hate_discrimination":"high","sexual":"high","threat":"critical","self_harm":"critical"}
SEVERITY_RANK = {"low":1,"medium":2,"high":3,"critical":4}
LEET_TRANSLATION = str.maketrans({"@":"a","4":"a","3":"e","1":"i","!":"i","0":"o","$":"s","5":"s","7":"t","8":"b","+":"t","|":"i"})
ZERO_WIDTH_RE = re.compile(r"[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\u2800\u3164\ufeff]")

def _nfkc(text: str) -> str:
    if not isinstance(text, str): return ""
    return unicodedata.normalize("NFKC", ZERO_WIDTH_RE.sub("", text)).casefold()

def _normalize_text(text: str) -> str:
    text = _nfkc(text).translate(LEET_TRANSLATION)
    text = re.sub(r"[`´‘’ʻʼ]", "'", text)

    # Remove punctuation while preserving Unicode letters, digits and combining
    # marks. The old ``[^\w\s]`` filter removed Indic vowel marks, which made
    # legitimate Hindi/Marathi/Bengali/etc. terms impossible to match exactly.
    cleaned = []
    for char in text:
        category = unicodedata.category(char)
        if char.isspace() or category[0] in {"L", "N", "M"} or char == "'":
            cleaned.append(char)
        else:
            cleaned.append(" ")

    text = "".join(cleaned)
    text = re.sub(r"(?<=\w)'(?=\w)", " ", text)
    text = re.sub(r"(.)\1{2,}", r"\1\1", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()

def _compact_text(text: str) -> str:
    return re.sub(r"\s+", "", _normalize_text(text))

def _term_is_short(term: str) -> bool:
    return len(term.replace(" ", "")) <= 3

def _contains_term(normalized: str, compact: str, term: str, original: str = "") -> bool:
    """Match a moderation term while resisting simple obfuscation.

    Matching order:
    1. Normal word/phrase boundaries.
    2. Punctuation/spacing inserted between characters.
    3. Stretched characters (``fuuuck`` -> ``fuck``).
    4. Asterisk masking (``fu***k`` -> ``fuck``).
    5. Leetspeak is already handled by normalization.

    Compact substring matching is deliberately *not* used for ordinary words;
    otherwise a short term such as ``porn`` would incorrectly match
    ``pornographic``.
    """
    term_norm = _normalize_text(term)
    if not term_norm:
        return False

    # Exact word/phrase match.
    if re.search(rf"(?<!\w){re.escape(term_norm)}(?!\w)", normalized, flags=re.UNICODE):
        return True

    # Match separators inserted between the letters of a term:
    # f.u.c.k / f-u-c-k / f u c k / f_*_u_*_c_*_k
    term_parts = [part for part in re.split(r"\s+", term_norm) if part]
    if len(term_parts) > 1:
        phrase_pattern = r"[\W_]+".join(re.escape(part) for part in term_parts)
        if re.search(rf"(?<!\w){phrase_pattern}(?!\w)", normalized, flags=re.UNICODE):
            return True

    compact_term = re.sub(r"\s+", "", term_norm)
    if not compact_term:
        return False

    # For single words, permit arbitrary non-word separators between letters.
    # Boundary checks prevent matching inside innocent longer words.
    if len(compact_term) >= 3:
        separator_pattern = r"[\W_]*".join(re.escape(ch) for ch in compact_term)
        if re.search(rf"(?<!\w){separator_pattern}(?!\w)", _nfkc(original or normalized), flags=re.UNICODE):
            return True

    # Collapse repeated characters in the user's input and retry exact matching.
    collapsed = re.sub(r"(.)\1+", r"\1", _normalize_text(original or normalized), flags=re.UNICODE)
    if re.search(rf"(?<!\w){re.escape(term_norm)}(?!\w)", collapsed, flags=re.UNICODE):
        return True

    # Asterisk masking. Treat ``*`` as hidden characters rather than requiring
    # the masked token to contain the complete profanity. This catches forms
    # such as ``fu**``, ``fu***k`` and ``f**k`` while requiring enough visible
    # characters to avoid flagging every short ``f*`` token.
    if original and "*" in original:
        term_compact = term_norm.replace(" ", "")
        for raw_token in re.findall(r"[^\s]+", _nfkc(original)):
            if "*" not in raw_token or len(term_compact) < 3:
                continue

            # Remove punctuation around/between the visible pieces but keep
            # asterisks as the masking boundaries.
            token = re.sub(r"[^\w*]", "", raw_token, flags=re.UNICODE)
            if "*" not in token:
                continue
            pieces = [p for p in token.split("*") if p]
            visible = "".join(pieces)
            if len(visible) < 2:
                continue

            # The visible characters must occur in order inside the configured
            # term. For a leading/trailing masked form, the visible edge must
            # also align with the corresponding edge of the term:
            #   fu**  -> fuck
            #   **ck  -> fuck
            #   f**k  -> fuck
            cursor = 0
            valid = True
            for index, piece in enumerate(pieces):
                pos = term_compact.find(piece, cursor)
                if pos < 0:
                    valid = False
                    break
                if index == 0 and not token.startswith("*") and pos != 0:
                    valid = False
                    break
                if index == len(pieces) - 1 and not token.endswith("*") and pos + len(piece) != len(term_compact):
                    valid = False
                    break
                cursor = pos + len(piece)
            if valid:
                return True

    return False

def _detect_script_language(text: str) -> set[str]:
    languages = set()
    for char in text:
        code = ord(char)
        if 0x0900 <= code <= 0x097F: languages.add("hi")
        elif 0x0980 <= code <= 0x09FF: languages.add("bn")
        elif 0x0A80 <= code <= 0x0AFF: languages.add("gu")
        elif 0x0A00 <= code <= 0x0A7F: languages.add("pa")
        elif 0x0B80 <= code <= 0x0BFF: languages.add("ta")
        elif 0x0C00 <= code <= 0x0C7F: languages.add("te")
        elif 0x0C80 <= code <= 0x0CFF: languages.add("kn")
        elif 0x0D00 <= code <= 0x0D7F: languages.add("ml")
        elif 0x0600 <= code <= 0x06FF or 0x0750 <= code <= 0x077F or 0x08A0 <= code <= 0x08FF: languages.update({"ar","ur"})
        elif 0x0400 <= code <= 0x04FF: languages.update({"ru","uk"})
        elif 0x0E00 <= code <= 0x0E7F: languages.add("th")
        elif 0x1100 <= code <= 0x11FF or 0xAC00 <= code <= 0xD7AF or 0x3130 <= code <= 0x318F: languages.add("ko")
        elif 0x3040 <= code <= 0x309F or 0x30A0 <= code <= 0x30FF: languages.add("ja")
        elif 0x4E00 <= code <= 0x9FFF: languages.add("zh")
    return languages

def check_comment_text(text: str) -> dict:
    try:
        if not isinstance(text, str): text = ""
        normalized, compact = _normalize_text(text), _compact_text(text)
        categories, matched_terms, matched_languages = set(), set(), set()
        script_languages = _detect_script_language(text)
        for language_code, language_categories in FLAGGED_TERMS.items():
            for category, terms in language_categories.items():
                for term in terms:
                    if _contains_term(normalized, compact, term, text):
                        categories.add(category); matched_terms.add(term); matched_languages.add(language_code)
        if matched_terms: matched_languages.update(x for x in script_languages if x in FLAGGED_TERMS)
        severity = "low"
        if categories:
            category = max(categories, key=lambda x: SEVERITY_RANK.get(CATEGORY_SEVERITY.get(x,"medium"),2))
            severity = CATEGORY_SEVERITY.get(category,"medium")
        return {"flagged": bool(matched_terms), "categories": sorted(categories), "matchedTerms": sorted(matched_terms), "languages": sorted(LANGUAGE_NAMES.get(x,x) for x in matched_languages), "languageCodes": sorted(matched_languages), "severity": severity, "checkFailed": False}
    except Exception:
        return {"flagged": False, "categories": [], "matchedTerms": [], "languages": [], "languageCodes": [], "severity": "low", "checkFailed": True}
