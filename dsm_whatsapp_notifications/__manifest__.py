{
    'name': 'DSM - Notifications WhatsApp Commandes',
    'version': '18.0.1.0.0',
    'summary': 'Envoi de messages WhatsApp aux clients lors des événements de commande',
    'category': 'Sales/CRM',
    'author': 'DSM Librairie',
    'depends': ['sale', 'stock', 'base_setup'],
    'data': [
        'security/ir.model.access.csv',
        'views/dsm_whatsapp_log_views.xml',
        'views/sale_order_views.xml',
        'views/res_config_settings_views.xml',
        'views/menu.xml',
    ],
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
