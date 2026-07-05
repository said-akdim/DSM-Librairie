{
    'name': 'DSM - Programme Fidélité VIP',
    'version': '18.0.2.0.0',
    'category': 'Sales/CRM',
    'summary': 'Carte virtuelle, analyse achats et recommandations — fusion DSM + Book VIP',
    'author': 'DSM Librairie',
    'depends': ['base', 'sale', 'stock', 'contacts', 'book_vip'],
    'data': [
        'security/ir.model.access.csv',
        'data/mail_template_carte.xml',
        'views/historique_points_views.xml',
        'views/notification_views.xml',
        'views/livre_prefere_views.xml',
        'views/res_partner_views.xml',
    ],
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
