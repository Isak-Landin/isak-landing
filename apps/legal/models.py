# apps/legal/models.py
from datetime import date

LEGAL_DOCS = [
    {
        "slug": "terms",
        "title": "Terms of Service",
        "filename": "HostNodex_Terms_of_Service_Longform.pdf",
        "category": "Customer-Facing",
        "version": "1.0",
        "effective": date(2025, 9, 1),
        "summary": "Master agreement governing the use of HostNodex services, subscriptions, liabilities, and dispute resolution."
    },
    {
        "slug": "privacy",
        "title": "Privacy Policy",
        "filename": "HostNodex_Privacy_Policy.pdf",
        "category": "Customer-Facing",
        "version": "1.0",
        "effective": date(2025, 9, 1),
        "summary": "GDPR-compliant notice on personal data collection, processing bases, rights, and retention."
    },
    {
        "slug": "aup",
        "title": "Acceptable Use Policy (AUP)",
        "filename": "HostNodex_Acceptable_Use_Policy.pdf",
        "category": "Customer-Facing",
        "version": "1.0",
        "effective": date(2025, 9, 1),
        "summary": "Rules on lawful and responsible use: no spam/malware/DDoS; enforcement & reporting."
    },
    {
        "slug": "cookies",
        "title": "Cookies Policy",
        "filename": "HostNodex_Cookies_Policy.pdf",
        "category": "Customer-Facing",
        "version": "1.0",
        "effective": date(2025, 9, 1),
        "summary": "Use of cookies; consent banner; management & retention; GDPR + ePrivacy alignment."
    },
    {
        "slug": "dpa",
        "title": "Data Processing Agreement (DPA)",
        "filename": "HostNodex_Data_Processing_Agreement.pdf",
        "category": "Business/Compliance",
        "version": "1.0",
        "effective": date(2025, 9, 1),
        "summary": "Processor–controller terms for business customers; subprocessors, SCCs, breach notice, audit rights."
    },
    {
        "slug": "kyc",
        "title": "KYC & Verification Policy",
        "filename": "HostNodex_KYC_Policy.pdf",
        "category": "Business/Compliance",
        "version": "1.0",
        "effective": date(2025, 9, 1),
        "summary": "When and how HostNodex requests ID/company verification to prevent fraud and abuse."
    },
    {
        "slug": "refunds",
        "title": "Refund & Cancellation Policy",
        "filename": "HostNodex_Refund_Cancellation_Policy.pdf",
        "category": "Customer-Facing",
        "version": "1.0",
        "effective": date(2025, 9, 1),
        "summary": "No refunds once the billing cycle starts; cancellations stop future renewals; EU withdrawal if not activated."
    },
    {
        "slug": "sla",
        "title": "Service Level Agreement (SLA)",
        "filename": "HostNodex_Service_Level_Agreement.pdf",
        "category": "Customer-Facing",
        "version": "1.0",
        "effective": date(2025, 9, 1),
        "summary": "99.0% monthly target; exclusions; no credits unless required by law; responsibilities."
    },
    {
        "slug": "imprint",
        "title": "Legal Imprint & Company Information",
        "filename": "HostNodex_Legal_Imprint.pdf",
        "category": "Public",
        "version": "1.0",
        "effective": date(2025, 9, 1),
        "summary": "Company identity and contact information per Swedish/EU transparency rules."
    },
]

DOC_INDEX = {d["slug"]: d for d in LEGAL_DOCS}
