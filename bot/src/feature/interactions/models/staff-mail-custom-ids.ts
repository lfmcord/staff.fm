import { StaffMailType } from '@src/feature/interactions/models/staff-mail-type';

export class StaffMailCustomIds {
    public static Category = 'staff-mail-create-category';
    public static CancelButton = 'cancel';
    public static ReportSendButton = 'staff-mail-create-' + StaffMailType.Report;
    public static ReportSendAnonButton = 'staff-mail-create-' + StaffMailType.Report + '-anon';
    public static CrownsReportSendButton = 'staff-mail-create-' + StaffMailType.CrownsReport;
    public static CrownsBanInquirySendButton = 'staff-mail-create-' + StaffMailType.CrownsBanInquiry;
    public static CrownsFalseCrownSendButton = 'staff-mail-create-' + StaffMailType.CrownsFalseCrown;
    public static CrownsOtherSendButton = 'staff-mail-create-' + StaffMailType.CrownsOther;
    public static LastfmSendButton = 'staff-mail-create-' + StaffMailType.Lastfm;
    public static ServerSendButton = 'staff-mail-create-' + StaffMailType.Server;
    public static OtherSendButton = 'staff-mail-create-' + StaffMailType.Other;
    public static OtherSendAnonButton = 'staff-mail-create-' + StaffMailType.Other + '-anon';

    public static ContactMemberSend = 'contact-member-send';
    public static ContactMemberSendAnon = 'contact-member-send-anon';
    public static ContactMemberCancel = 'contact-member-cancel';
}
